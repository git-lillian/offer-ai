# AGENTS.md — Engineering rules for coding agents

Offer.ai is a modular monolith: `apps/web` (Next.js), `apps/worker` (Node),
framework-free `packages/*`, Supabase Postgres, and a strict architecture
documented in `docs/`. Read before writing code.

## Read the docs first

- `docs/architecture/system-overview.md` — layering, boundaries, what runs where
- `docs/architecture/database.md` — schema, migrations, conventions
- `docs/architecture/security.md` — RLS, auth, secrets
- `docs/product/domain-map.md` — bounded contexts and statuses
- `docs/adr/` — architectural decisions (read the relevant ones)
- `node_modules/next/dist/docs/` — this Next.js version has breaking changes
  vs. training data (proxy.ts not middleware.ts, async cookies/params, …).
  Heed deprecation notices.

## Non-negotiable rules

1. **No business logic in React components, route handlers or server
   actions.** UI is presentation; delivery layers authenticate, validate,
   orchestrate and map results. Business rules live in `packages/domain`
   services or application services.
2. **`packages/domain` is framework-free.** Never import Next.js, React,
   Supabase, Stripe or AI SDKs into it. The same applies to other packages
   unless they are UI/delivery by definition.
3. **Never bypass RLS.** Client data access goes through the RLS-enforced
   Supabase clients. Service-role credentials are server/worker only and
   never in client bundles.
4. **No canonical data in localStorage.** Postgres is canonical; browser
   storage may hold ephemeral UI state only.
5. **No long-running work in HTTP requests.** Enqueue a background job
   instead of running AI/crawling/document processing inline.
6. **No AI provider construction outside `packages/ai`.** Use the provider
   abstraction; model names and API keys never appear in application code.
7. **Migrations are mandatory.** Every database change is a new numbered SQL
   file in `supabase/migrations/`. Never edit an applied migration.
8. **Validate every boundary with zod** (`packages/contracts`): route
   payloads, form input, AI output, queue messages, webhook payloads.
9. **Never trust `user_id` from the browser.** Derive identity from the
   authenticated session server-side; resolve the student profile id from the
   session, never from the request body.
10. **AI output never silently becomes verified student fact.** It enters
    the evidence pipeline as `machine_extracted` and requires confirmation.
11. **The LLM never decides eligibility.** `packages/admissions-engine` is
    deterministic; LLM explains, rules decide.
12. **Use typed contracts and typed errors.** No raw database/provider error
    strings to the user; map through `DomainError` subclasses.
13. **No `any`** unless exceptionally justified and documented.
14. **No circular dependencies between packages**; `domain` is the base of
    the dependency graph.
15. **Log with the structured logger** (`packages/config` logger), not random
    `console.log`, and propagate correlation ids.
16. **Add tests for domain behaviour** (unit) and RLS boundaries
    (`supabase/tests`). Run the full gate before finishing.
17. **Controlled writes for sensitive aggregates.** Application cases,
    events, prospect creation and student claiming are written only through
    security-definer RPCs (`create_application_case`,
    `transition_application_case`, `append_application_event`,
    `create_prospect`, `claim_student_profile`) that re-check authorization
    and enforce invariants inside one transaction. Client tables keep
    read-only policies for these aggregates. Do not add client insert/update
    policies for them.
18. **Volatile facts live in the database.** Deadlines, fees and other
    date-bearing decision-critical facts belong in the catalogue with
    provenance — never hard-coded in country adapters or application code.

## Quality gate (run all, fix everything)

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:test        # needs local Supabase stack running
pnpm build
```

## Working with the database

- Apply changes locally: `pnpm db:migrate`, `pnpm db:seed`.
- RLS tests: `pnpm db:test` (creates real users; uses `.env.local`).
- Statuses use `text` + `CHECK`, not database enums.
- UUID primary keys, foreign keys indexed, timestamptz everywhere.

## Conventions

- TypeScript strict; `verbatimModuleSyntax`-style type-only imports.
- Focused files; one responsibility per module.
- New packages must not import Next.js or React (except `packages/ui`).
- Update `docs/` when architecture changes; write an ADR for major choices.
