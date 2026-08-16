# Offer.ai

Offer.ai is a digital university admissions platform: a guided process that
helps students build stronger applications — onboarding, eligibility,
application cases, documents, AI-assisted writing and (future) human
advisers.

This repository is the **production foundation**: a modular monolith with a
background worker, framework-free domain packages, a migration-controlled
Supabase database with Row Level Security, and a working end-to-end student
flow.

## Repository layout

```text
apps/
  web/            Next.js application (UI + route handlers + server actions)
  worker/         Node background worker (durable job consumer)
packages/
  domain/         entities, value objects, errors, services (framework-free)
  contracts/      zod schemas + DTOs at application boundaries
  database/       Supabase clients, repositories, typed schema
  ai/             AI provider abstraction (DeepSeek, fake) + prompts
  admissions-engine/  deterministic eligibility pipeline + country adapters
  ingestion/      ingestion pipeline interfaces (no crawler yet)
  billing/        billing domain types (Stripe later)
  notifications/  notification interfaces
  ui/             shared React presentation components
  config/         environment validation, feature flags, logger
supabase/
  migrations/     versioned SQL migrations (source of truth for the schema)
  seed.sql        development seed data
  tests/          RLS + background-job integration tests
docs/
  architecture/   system, database, security, ai, jobs, ingestion, country
  product/        vision, domain map
  adr/            architectural decision records
  runbooks/       local development
tests/
  e2e/            Playwright critical-flow tests
```

## Quick start

Prerequisites: Node ≥ 20, pnpm ≥ 9, Docker (local Supabase stack).

```bash
pnpm install
cp .env.example .env.local      # fill in local Supabase values (see runbook)
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # development data
pnpm dev                        # web app on http://localhost:3000
pnpm worker:dev                 # background worker (separate terminal)
```

Full instructions: [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).

## Quality gates

```bash
pnpm typecheck      # strict TS across the workspace
pnpm lint           # eslint (no warnings tolerated)
pnpm test           # unit tests
pnpm db:test        # integration + RLS tests against local Supabase
pnpm test:e2e       # Playwright critical flows (browser)
pnpm build          # production build
```

## Architecture in one paragraph

The web app and the worker share the same domain packages. Business logic
lives in `packages/domain` (pure TypeScript, no framework imports);
repositories are implemented in `packages/database` against Supabase
Postgres, where Row Level Security protects every student-adjacent table;
AI inference goes through the provider abstraction in `packages/ai`; and
long-running work is enqueued as durable Postgres-backed jobs consumed by
`apps/worker`.

- [System overview](docs/architecture/system-overview.md)
- [Database](docs/architecture/database.md)
- [Security](docs/architecture/security.md)
- [AI](docs/architecture/ai.md)
- [Background jobs](docs/architecture/background-jobs.md)
- [Domain map](docs/product/domain-map.md)
- [Implementation roadmap](docs/product/implementation-roadmap.md)
- [ADR index](docs/adr/)
- [Prototype migration plan](docs/architecture/prototype-migration.md)

## Status

Implemented: authentication (Supabase), Student 360 as an independent domain
entity (adviser-created prospects, claiming, scoped access grants), onboarding,
application-case creation with append-only event history and atomic
DB-enforced transitions, a browseable **UK admissions catalogue**
(`/universities`, institution + course pages) with PostgreSQL search,
filtering, pagination and source-provenance display, hardened catalogue
schema, RLS on all student data, AI provider abstraction with run ledger,
Postgres-backed background worker with one demo job, 80+ automated tests
incl. RLS + catalogue integration suites, CI with fresh-Supabase integration
and e2e jobs, and documentation.

Planned next (see the roadmap): real UK ingestion, recommendation engine v1,
application OS, document studio, marketplace. See
[`docs/product/implementation-roadmap.md`](docs/product/implementation-roadmap.md).
