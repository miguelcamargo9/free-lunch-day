# ADR 0001 — Serverless en AWS en lugar de contenedores

- Estado: aceptado
- Fecha: 2026-11-07

## Contexto

El reto pide microservicios dockerizados con su propio Dockerfile, o arquitectura serverless como PLUS. El sistema debe aguantar ráfagas de pedidos, sobrevivir reinicios y correr en una capa gratuita sin costo.

## Decisión

- Cada microservicio es un proyecto de **Serverless Framework v4** con su `serverless.yml`, sus Lambdas (Node.js 22, ARM64, empaquetadas con esbuild) y sus tablas DynamoDB on-demand.
- Los servicios se despliegan de forma independiente; solo comparten el bus de eventos (infra base) y el paquete de contratos.
- Para desarrollo local hay un `docker-compose.yml` con LocalStack y DynamoDB Local.

## Consecuencias

- Escala a cero y por demanda: una ráfaga de 1.000 platos no requiere aprovisionar nada, y sin tráfico el costo es ~0.
- La persistencia sobrevive reinicios por diseño: no hay servidores que apagar.
- Hay cold starts. Se mitigan con bundles pequeños y ARM64.
- Serverless v4 exige login en serverless.com y una `SERVERLESS_ACCESS_KEY` en CI (gratis para individuos).

## Alternativas descartadas

- **ECS Fargate o EC2 con un Dockerfile por servicio**: cumple la opción base, pero Fargate no tiene capa gratuita, y una EC2 t3.micro con todos los contenedores es un punto único de falla que escala manualmente.
- **AWS CDK / SST**: válidos, pero el reto nombra Serverless Framework explícitamente y `serverless.yml` por servicio expresa mejor la independencia de cada microservicio.
