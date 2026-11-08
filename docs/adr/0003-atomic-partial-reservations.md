# ADR 0003 — Reservas atómicas y parciales del inventario

- Estado: aceptado
- Fecha: 2026-11-07

## Contexto

La bodega arranca con 5 unidades por ingrediente, y en una ráfaga cientos de platos las piden a la vez. Sin control de concurrencia, dos platos leen "hay 1 tomate", ambos lo descuentan y el stock queda negativo. Además, la plaza puede vender menos de lo pedido o 0.

## Decisión

- Cada ingrediente es un ítem en DynamoDB. Todo descuento es un `UpdateItem` condicional (`stock >= :n`), así que el stock nunca puede quedar negativo.
- La reserva es **parcial**: un plato toma lo que haya y pide a la plaza solo lo que le falta.
- Lo comprado se **asigna primero al plato que lo pidió**, y el sobrante va al stock general.
- La reserva es el descuento que pide el enunciado ("se descuentan al prepararlo"): el plato pasa a `PREPARING` solo cuando tiene todo reservado.

## Consecuencias

- El throughput escala con los Lambdas en paralelo; la contención se limita a un ítem por ingrediente.
- No hay deadlock: ningún plato espera a que otro libere stock, todo faltante se compra.
- No hay inanición: la compra de un plato no puede quedársela otro.
- Un plato puede tener stock reservado mientras espera el resto. Es aceptable, porque la plaza es la fuente infinita y ese stock se usa igual.

## Alternativas descartadas

- **Reserva todo o nada con `TransactWriteItems`**: con 5 unidades y alta demanda casi todas las transacciones fallarían y se reintentarían, y todos los platos acabarían comprando todo.
- **Cola FIFO con un solo grupo que serializa la bodega**: correcto y simple, pero limita el throughput a un consumidor y convierte la bodega en el cuello de botella.
- **Lock distribuido**: más piezas y más latencia que una escritura condicional, sin ventaja.
