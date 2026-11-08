# ADR 0002 — Comunicación por eventos: EventBridge + SQS por consumidor

- Estado: aceptado
- Fecha: 2026-11-07

## Contexto

Cocina, bodega y plaza tienen ritmos muy distintos: la cocina genera cientos de platos en un segundo, y la plaza responde lento y a veces no vende. Si los servicios se llaman por HTTP, la lentitud de uno se propaga a todos y una ráfaga los tumba en cadena.

## Decisión

- Un bus de **EventBridge** (`lunch-bus`) por el que pasan todos los eventos de dominio definidos en `packages/contracts`.
- Cada servicio consumidor tiene una **cola SQS con DLQ** como destino de su regla. El Lambda lee de la cola, nunca directo del bus.
- Ningún servicio llama a otro por HTTP. Las únicas entradas HTTP son las del dashboard (`POST /orders`, `POST /assistant`).

## Consecuencias

- Agregar un consumidor (por ejemplo `realtime` o una analítica) es agregar una regla, sin tocar a los productores.
- La cola desacopla ritmos: absorbe la ráfaga, reintenta y permite limitar la concurrencia del Lambda de compras.
- La entrega es al menos una vez: todos los handlers deben ser idempotentes.
- No hay orden global entre eventos: la lógica no puede depender de él. La máquina de estados del plato usa escrituras condicionales.

## Alternativas descartadas

- **HTTP síncrono entre servicios**: acoplamiento temporal y fallos en cascada.
- **SNS + SQS**: sirve, pero el filtrado por contenido y la integración nativa de EventBridge (archivo, replay, reglas por `detail-type`) son mejores para un bus de dominio.
- **Kinesis**: orden por partición, pero sobredimensionado y con costo fijo por shard.
