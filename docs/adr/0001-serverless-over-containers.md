# ADR 0001 — Serverless on AWS instead of containers

- Status: accepted
- Date: 2026-11-07

## Context

The brief asks for dockerized microservices with one Dockerfile each, or a serverless architecture as a PLUS. The system must absorb bursts of orders, survive restarts and run on a free tier at no cost.

## Decision

- Each microservice is a **Serverless Framework v4** project with its own `serverless.yml`, its Lambdas (Node.js 22, ARM64, bundled with esbuild) and its on-demand DynamoDB tables.
- Services deploy independently; they share only the event bus (base infrastructure) and the contracts package. `serverless-compose.yml` deploys everything in dependency order.
- For local development, a `docker-compose.yml` runs LocalStack and DynamoDB Local.

## Consequences

- Scales to zero and on demand: a 1,000-dish burst needs nothing provisioned, and with no traffic the cost is ~0.
- Persistence survives restarts by design: there is no server to stop.
- There are cold starts. Small bundles and ARM64 keep them short.
- Serverless v4 requires a serverless.com login and a `SERVERLESS_ACCESS_KEY` in CI (free for individuals).

## Rejected alternatives

- **ECS Fargate or EC2 with a Dockerfile per service**: meets the base option, but Fargate has no free tier, and a single t3.micro running every container is a single point of failure that scales by hand.
- **AWS SAM**: AWS-native and needs no extra account, but templates are more verbose and there is no equivalent of `serverless-compose` to deploy and wire several services; the brief also names Serverless Framework explicitly.
- **AWS CDK / SST**: valid, but more code than configuration for this size, and a `serverless.yml` per service shows each microservice's independence more clearly.
