import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export function createDocumentClient(config: DynamoDBClientConfig = {}): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient(config), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

function hasCancellationReason(error: unknown, code: string): boolean {
  return (
    error instanceof TransactionCanceledException &&
    (error.CancellationReasons ?? []).some((reason) => reason.Code === code)
  );
}

export function isConditionFailure(error: unknown): boolean {
  return (
    error instanceof ConditionalCheckFailedException ||
    hasCancellationReason(error, 'ConditionalCheckFailed')
  );
}

export function isWriteConflict(error: unknown): boolean {
  return isConditionFailure(error) || hasCancellationReason(error, 'TransactionConflict');
}

export async function putIfAbsent<TItem extends object>(
  client: DynamoDBDocumentClient,
  tableName: string,
  keyName: keyof TItem & string,
  item: TItem,
): Promise<TItem> {
  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: item as Record<string, unknown>,
        ConditionExpression: 'attribute_not_exists(#key)',
        ExpressionAttributeNames: { '#key': keyName },
      }),
    );
    return item;
  } catch (error) {
    if (!isConditionFailure(error)) throw error;
    const { Item } = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { [keyName]: item[keyName] },
        ConsistentRead: true,
      }),
    );
    if (!Item) throw error;
    return Item as TItem;
  }
}
