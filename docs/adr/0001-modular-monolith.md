# ADR 0001 — Modular Monolith with Background Worker

- Status: accepted
- Date: 2026-08-15
- Deciders: platform engineering

## Context

Offer.ai has ~28 future product domains (catalogue, eligibility, documents,
marketplace, billing, ingestion…). A distributed-microservices start would
add coordination overhead (service boundaries, network, deployment) while
the team is still discovering the domain. A single Next.js app with all
business logic inside it would become an unmaintainable ball of mud as the
domain grows.

## Decision

Build a **modular monolith with a background worker**:

- One web application (`apps/web`) handling UI + synchronous delivery.
- One worker application (`apps/worker`) handling durable background jobs,
  sharing the same domain packages.
- Business logic in framework-free packages under `packages/` with explicit
  bounded contexts and repository interfaces.
- pnpm workspaces as the monorepo tool. **No Turborepo at this stage** —
  pnpm's filtered scripts cover build/test orchestration; Turborepo would add
  caching complexity without a proven need.

## Consequences

- Strong module boundaries allow extracting any domain into a separate
  service later without rewriting it.
- One deployable unit keeps operations simple; the worker is deployed
  separately but from the same repo.
- Discipline is required to keep `packages/domain` free of framework imports
  — enforced by dependency rules in CI (and `tsconfig` isolation).
- If a domain genuinely needs independent scaling (e.g. ingestion), it can
  be extracted as a service with its own queue consumer.

## Alternatives considered

- Microservices from day one: rejected — premature distribution, no proven
  scaling need, higher coordination cost.
- Single flat Next.js app: rejected — no domain boundaries, business logic
  would drift into components/routes.
- Turborepo: deferred — pnpm workspaces suffice at current scale; revisit
  when task caching becomes a bottleneck.
