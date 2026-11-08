# AGENTS.md

Conventions for anyone (human or AI agent) changing this repo. Read `docs/ARCHITECTURE.md` first.

## Stack and hard rules

- Node.js 22 + TypeScript (strict). Lambdas deployed with Serverless Framework v4, bundled with esbuild.
- **No web frameworks**: no Express, Nest, Fastify, Hono, Middy. Handlers are plain functions; utility libraries (AWS SDK v3, Powertools, zod) are fine.
- Services talk **only through events** on EventBridge. Never call another service over HTTP. Only `market` calls the external farmers-market API.
- Event shapes live in `packages/contracts`. Change the contract there first, then the producers and consumers. Never define an event shape inside a service.
- Every handler is **idempotent**: conditional writes keyed by `dishId + step`. Duplicated messages must have no effect.
- No `sleep`/`setTimeout` waits inside Lambdas. Retry with SQS `DelaySeconds`.
- DynamoDB writes that depend on current state use a `ConditionExpression`. Inventory can never go negative.
- IAM permissions are scoped to specific resources. Never `Resource: '*'` on data actions.

## Layout

```
apps/web               React dashboard
services/<name>        one microservice: serverless.yml, src/, test/
  src/handlers         AWS adapters: parse input, call a use case, map the result
  src/application      use cases; depend on ports (interfaces), not on AWS SDK
  src/domain           pure logic, no I/O, fully unit tested
  src/infrastructure   port implementations (DynamoDB, EventBridge, HTTP)
packages/contracts     zod schemas for every event and shared value type
packages/shared        cross-cutting helpers (logger, idempotency, event publishing)
docs/                  PLANNING, ARCHITECTURE, ADRs, ai.md, load-testing.md
```

Dependencies point inward: `handlers → application → domain`. `domain` imports nothing from AWS.

## Code style

- Small single-purpose functions; extract shared logic to `packages/shared` instead of copying it between services.
- Named exports only. File names in kebab-case.
- Validate every external input (HTTP body, SQS message, API response) with zod at the boundary.
- Code, identifiers and commit messages in English; product docs in Spanish.

## Commands

```bash
nvm use            # Node 22
npm install
npm run verify     # lint + format check + typecheck + tests (CI runs the same)
npm test           # vitest
```

## Workflow

- One issue per task (1–3 h) with acceptance criteria; one PR per issue.
- Conventional commits (`feat(warehouse): ...`, `fix(market): ...`, `docs: ...`).
- Domain logic gets tests first (reservations, state machine, backoff).
- A task is done when `npm run verify` passes and the definition of done in `docs/PLANNING.md` holds.
