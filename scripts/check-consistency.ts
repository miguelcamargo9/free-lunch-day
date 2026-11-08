import { DynamoDBClient, paginateListTables } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, paginateScan } from '@aws-sdk/lib-dynamodb';
import { DISH_STATUSES, INGREDIENTS, type DishStatus, type Ingredient } from '@lunch/contracts';

const INITIAL_STOCK = 5;
const stage = process.env.STAGE ?? 'dev';

type Row = Record<string, unknown>;
interface Line {
  needed: number;
  reserved: number;
}

const raw = new DynamoDBClient({});
const client = DynamoDBDocumentClient.from(raw);

async function findTable(service: string, logicalId: string): Promise<string> {
  const prefix = `lunch-${service}-${stage}-${logicalId}-`;
  for await (const page of paginateListTables({ client: raw }, {})) {
    const name = page.TableNames?.find((table) => table.startsWith(prefix));
    if (name) return name;
  }
  throw new Error(`No table starts with ${prefix}`);
}

async function scanAll(service: string, logicalId: string): Promise<Row[]> {
  const rows: Row[] = [];
  const TableName = await findTable(service, logicalId);
  for await (const page of paginateScan({ client }, { TableName }))
    rows.push(...(page.Items ?? []));
  return rows;
}

const perIngredient = () =>
  Object.fromEntries(INGREDIENTS.map((ingredient) => [ingredient, 0])) as Record<
    Ingredient,
    number
  >;

const [inventory, reservations, purchases, orders, dishes] = await Promise.all([
  scanAll('warehouse', 'InventoryTable'),
  scanAll('warehouse', 'ReservationsTable'),
  scanAll('market', 'PurchasesTable'),
  scanAll('orders', 'OrdersTable'),
  scanAll('orders', 'DishesTable'),
]);

const violations: string[] = [];

const stock = perIngredient();
for (const ingredient of INGREDIENTS) stock[ingredient] = INITIAL_STOCK;
for (const row of inventory) stock[row.ingredient as Ingredient] = row.stock as number;

const bought = perIngredient();
for (const row of purchases) bought[row.ingredient as Ingredient] += row.quantitySold as number;

const reserved = perIngredient();
const completeDishes = new Set<string>();
for (const row of reservations) {
  const lines = Object.entries(row.lines as Record<Ingredient, Line>) as [Ingredient, Line][];
  for (const [ingredient, line] of lines) {
    reserved[ingredient] += line.reserved;
    if (line.reserved > line.needed) {
      violations.push(`dish ${String(row.dishId)} over-reserved ${ingredient}`);
    }
  }
  if (lines.every(([, line]) => line.reserved === line.needed))
    completeDishes.add(row.dishId as string);
}

const stockReport = INGREDIENTS.map((ingredient) => {
  const expected = INITIAL_STOCK + bought[ingredient] - reserved[ingredient];
  if (stock[ingredient] !== expected) {
    violations.push(
      `${ingredient}: stock ${stock[ingredient]} but 5 + bought − reserved = ${expected}`,
    );
  }
  if (stock[ingredient] < 0) violations.push(`${ingredient}: negative stock`);
  return {
    ingredient,
    stock: stock[ingredient],
    bought: bought[ingredient],
    reserved: reserved[ingredient],
  };
});

const dishesByOrder = new Map<string, number>();
const statusCounts = Object.fromEntries(DISH_STATUSES.map((status) => [status, 0])) as Record<
  DishStatus,
  number
>;
for (const dish of dishes) {
  const orderId = dish.orderId as string;
  dishesByOrder.set(orderId, (dishesByOrder.get(orderId) ?? 0) + 1);
  statusCounts[dish.status as DishStatus] += 1;
  if (dish.status === 'DELIVERED' && !completeDishes.has(dish.dishId as string)) {
    violations.push(`dish ${String(dish.dishId)} delivered without a complete reservation`);
  }
}
for (const order of orders) {
  const created = dishesByOrder.get(order.orderId as string) ?? 0;
  if (created !== order.quantity) {
    violations.push(
      `order ${String(order.orderId)} has ${created} dishes, expected ${String(order.quantity)}`,
    );
  }
}

console.table(stockReport);
console.log({
  orders: orders.length,
  dishes: dishes.length,
  ...statusCounts,
  purchaseAttempts: purchases.length,
  reservations: reservations.length,
});
if (violations.length > 0) {
  console.error(`\n${violations.length} violation(s):\n- ${violations.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll invariants hold.');
