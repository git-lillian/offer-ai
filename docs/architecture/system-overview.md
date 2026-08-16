# System Overview

## Architecture in one paragraph

Offer.ai is a **modular monolith with a background worker**. One Next.js web
application (`apps/web`) delivers the product UI and HTTP API; one Node.js
worker (`apps/worker`) runs durable background jobs. All business logic lives
in framework-free packages under `packages/`, the database is Supabase
Postgres (migration-controlled, RLS-protected), and AI is an interchangeable
provider behind `packages/ai`. The modules have explicit boundaries so that
individual domains can later be extracted into separate services without a
rewrite.

## Runtime topology (foundation)

```text
┌─────────────────────┐      ┌──────────────────────┐
│  apps/web (Next.js) │      │  apps/worker (Node)  │
│  UI + route handlers│      │  job consumer         │
└─────────┬───────────┘      └──────────┬───────────┘
          │                             │
          │  application services       │  same domain packages
          ▼                             ▼
  ┌─────────────────────────────────────────────┐
  │  packages: domain · contracts · database    │
  │  · admissions-engine · ai · ingestion       │
  │  · billing · notifications · ui · config    │
  └─────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
   ┌─────────────┐         ┌──────────────────┐
   │  Supabase   │         │  External AI      │
   │  Postgres   │◄────────│  providers        │
   │  (RLS)      │         │  (DeepSeek, …)    │
   │  Storage    │         └──────────────────┘
   │  Auth       │
   └─────────────┘
```

The web app and worker share the same domain packages, so business rules are
identical regardless of entry point.

## Layer architecture

```text
UI (React components, packages/ui + apps/web)
  ↓
delivery layer (route handlers, server actions, pages)
  ↓
application services (orchestrate: authenticate → validate → call domain → persist)
  ↓
domain (entities, value objects, services, repository interfaces — pure TS)
  ↓
repositories/interfaces (packages/database implements domain ports)
  ↓
infrastructure (Supabase Postgres, Storage, Auth, external providers)
```

Rules enforced here:

- Business logic never lives in React components, route handlers, or server
  actions. Those only authenticate, validate, orchestrate and map results.
- `packages/domain` imports nothing from Next.js, React, Supabase, or AI SDKs.
- AI prompts are versioned assets, not logic.

## What runs where

| Concern | Location |
| --- | --- |
| Authentication/session | Supabase Auth via `apps/web` helpers (`src/lib/auth.ts`, `src/proxy.ts` session refresh) |
| Environment validation at startup | `packages/config` (`getServerEnv`/`getClientEnv`, zod); web app validates on server bootstrap |
| Long-running work (AI calls, crawling, document processing) | `apps/worker` jobs (never inside HTTP requests) |
| Student data reads/writes | `apps/web` via `packages/database` repositories (RLS enforced) |
| Catalogue ingestion | future `apps/worker` jobs using `packages/ingestion` |
| AI inference | `apps/worker` (and in future, short ops) `apps/web` via `packages/ai` |

## Key decisions (summary)

- Monorepo managed with **pnpm workspaces**; no Turborepo (pnpm scripts are
  sufficient at this scale — see ADR 0001).
- **Supabase Postgres** as the source of truth; schema in Git as migrations
  (ADR 0002).
- **Postgres-backed job queue** for background jobs; no Redis/Kafka at this
  stage (ADR 0003). Jobs live in `public.background_jobs`, consumed by
  `apps/worker` via `FOR UPDATE SKIP LOCKED` polling.
- **Country adapters** for admissions rules; UK first (ADR 0004).
- All new packages are TypeScript-first, strict mode, framework-free.
- Environment configuration is validated with zod on startup
  (`packages/config`); missing production config fails fast.

## Infrastructure that is intentionally NOT present

- No microservices, no Kubernetes, no Kafka, no Elasticsearch, no Redis,
  no GraphQL, no ORM, no external feature-management SaaS.
- PostgreSQL search is the search layer (a search abstraction is planned).
- Stripe integration comes after billing domain types are stable.

## Feature flags

`packages/config` provides a simple, env-driven feature-flag mechanism
(e.g. `uk_admissions`, `expert_marketplace`). Flags are compile-time
constants from validated environment variables.

## Repository map

```text
apps/web/          Next.js application (UI + delivery)
apps/worker/       Node background worker (durable jobs)
packages/domain/   entities, value objects, errors, repository interfaces
packages/contracts/  shared DTOs, zod schemas at boundaries
packages/database/   migrations, repositories, Supabase clients
packages/admissions-engine/  eligibility pipeline, country adapters, rules
packages/ai/       AI provider abstraction, prompts, usage ledger
packages/ingestion/  ingestion pipeline interfaces (no crawler yet)
packages/billing/  billing domain types (Stripe later)
packages/notifications/  notification interfaces
packages/ui/       shared React presentation components
packages/config/   environment validation, feature flags, logger
supabase/          migrations, seed, RLS tests
docs/              architecture, product, ADRs, runbooks
tests/             cross-cutting test utilities
```

## Data flow example: create application case

1. Student submits the "new case" form in `apps/web`.
2. Route handler authenticates the session, resolves the authenticated
   user's student profile (never trusting a browser-supplied student id),
   and validates the payload with a zod schema from `packages/contracts`.
3. Application service in `apps/web` calls `ApplicationCaseService.create(...)`
   from `packages/domain`, which validates the institution/course/intake/cycle
   invariants and the open cycle.
4. The database repository persists through the `create_application_case`
   security-definer RPC, which inserts the case **and** its `created` event
   in one transaction (RLS-checked inside the function). Transitions and
   event appends use the matching RPCs.
5. The route maps domain errors to HTTP responses and returns.
6. A background job may be enqueued for follow-up work (e.g. document
   processing) — never awaited inline.
