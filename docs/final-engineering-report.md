# Offer.ai Foundation — Final Engineering Report

## 1. Architecture created

Offer.ai is now a **pnpm monorepo with a modular monolith + background
worker**:

```text
apps/web        Next.js 16 application — UI, route handlers, server actions,
                request proxy (session refresh + route protection)
apps/worker     Node background worker — Postgres-backed durable job queue

packages/domain             pure TS entities, value objects, typed errors,
                            repository interfaces, domain services
packages/contracts          zod schemas + DTOs at every application boundary
packages/database           Supabase clients (browser/server/service-role),
                            repositories, hand-written Database type
packages/ai                 AIProvider abstraction (DeepSeek + fake adapters),
                            versioned prompts, run ledger, cost estimation
packages/admissions-engine  deterministic eligibility pipeline, country
                            adapter interface, UK adapter v1
packages/ingestion          ingestion pipeline interfaces (no crawler yet)
packages/billing            billing domain types (Stripe later)
packages/notifications      notification interfaces
packages/ui                 shared React presentation components
packages/config             env validation (zod), feature flags, logger

supabase/migrations        10 versioned SQL migrations (schema = Git)
supabase/seed.sql          safe development data (no real personal data)
supabase/tests             RLS + job-queue integration tests (53 tests)
tests/e2e                  Playwright critical-flow tests (2 scenarios)
```

Key architectural properties:

- **Business logic lives in `packages/domain`** (framework-free: no
  Next.js/React/Supabase/AI imports). Application services orchestrate
  domain services through repository interfaces; delivery layers only
  authenticate, validate with zod, and map results.
- **AI is behind `packages/ai`**: the model name and provider SDK appear in
  exactly one adapter; structured output is zod-validated; every run is
  recorded in `ai_runs` with token usage and cost.
- **Eligibility is deterministic** (`packages/admissions-engine`): the LLM
  can never decide eligibility; country adapters make the UK the first
  implementation with US/Canada/Australia addable without touching UK code.
- **Durable jobs on Postgres** (ADR 0003): `background_jobs` with
  idempotency keys, `FOR UPDATE SKIP LOCKED` claiming, retries with
  exponential backoff — no Redis/Kafka at this stage.
- **Versioned, provenance-aware catalogue**: effective-dated requirements,
  source registry, immutable snapshots — ingestion interfaces ready but no
  crawler implemented (by design).
- **Consent, access grants and audit** are first-class domain concepts with
  tables and RLS coverage, not checkboxes.

## 2. Existing code retained

| Item | Why |
| --- | --- |
| Supabase Auth as the auth provider | Appropriate production choice; hardened with server-side validation, protected routes, no console logging |
| DeepSeek as the first AI provider | Real provider, now behind `packages/ai` |
| Personal statement prompt intent | Migrated into `packages/ai/prompts` as a versioned asset (v1) |
| Wizard/progress-bar UI concepts | Rebuilt in `packages/ui` (accessible, typed) and reused by onboarding |
| Visual language (slate/blue, cards) | Kept across pages |
| Tailwind v4 + globals.css setup | Kept in `apps/web` |

## 3. Existing code replaced

| Item | Why |
| --- | --- |
| localStorage-canonical personal-statement wizard/result pages | Violated "Postgres is canonical"; replaced by the onboarding flow persisted via server actions |
| Direct `new OpenAI()` in a route handler | Violated provider abstraction rule; moved behind `packages/ai` |
| Client-side-only register/login with console logs | No server validation, no protected routing; rewritten as zod-validated server actions with session-aware navigation |
| Direct `review_orders` browser inserts | No migration existed; table was outside version control. The marketplace will return through the proper domain |
| Placeholder pricing/how-it-works pages | No content; removed |
| Static navbar | Rewritten session-aware |

The prototype remains in Git history (commit `7876860` restores it fully);
the migration plan is documented in
`docs/architecture/prototype-migration.md`.

## 4. Database migrations

Ten migrations in `supabase/migrations/`, applied transactionally and
recorded in `public.schema_migrations`:

| Migration | Content |
| --- | --- |
| 0001_identity | roles, user_roles, preferences, organisations, memberships |
| 0002_students | student_profiles, education, qualifications, experiences, goals |
| 0003_evidence_documents | evidence_items, documents |
| 0004_catalog | subjects, institutions, courses, intakes, cycles, effective-dated requirements, sources, snapshots |
| 0005_admissions | application_cases, append-only application_events, tasks, case-documents |
| 0006_artifacts | artifacts + immutable artifact_versions + latest-version trigger |
| 0007_platform | access_grants, consents, audit_logs, ai_runs, background_jobs |
| 0008_rls | RLS enabled + policies on every table + private storage bucket |
| 0009_functions | `handle_new_user` signup hook (profile + role + prefs) |
| 0010_job_queue_function | atomic idempotent `enqueue_job` |

Conventions: UUID PKs, `text + CHECK` statuses (no enums), indexed FKs,
`timestamptz` everywhere, JSONB only for flexible metadata.

## 5. Security

- **RLS enforced on every student-adjacent table.** The browser client
  (anon key) can only see the student's own rows; `has_student_access()`
  (SECURITY DEFINER) powers adviser/guardian grants inside policies, so RLS
  is never bypassed by the client.
- **Internal tables** (`audit_logs`, `ai_runs`, `background_jobs`,
  `catalog_source_snapshots`) have RLS enabled with no client policies —
  service-role only.
- **Three client factories**: browser (session, RLS), server (cookies,
  RLS), service-role (server/worker only, never bundled).
- **Never trust the browser**: `student_id`/`user_id` are derived from the
  authenticated session server-side; server actions call `requireUser()`.
- **Protected routes** via the Next 16 request proxy (`src/proxy.ts`) plus
  server-side guards in every page/action.
- **Private storage** bucket `student-documents` with owner-scoped object
  policies; no permanent public URLs.
- **Secrets**: `.env.example` documents variables; env is validated with
  zod at startup (fails fast); service-role key never in `NEXT_PUBLIC_*`.
- **Threat model** documented in `docs/architecture/security.md`.

## 6. Tests — actual commands executed and results

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 0 errors (all packages + apps) |
| `pnpm lint` | 0 errors, 0 warnings (`--max-warnings 0`) |
| `pnpm test` | 36 unit tests passed (domain 9, contracts 9, admissions-engine 12, ai 6) |
| `pnpm db:test` | 53 integration/RLS tests passed against the local Supabase stack |
| `pnpm build` | Next.js production build + worker typecheck passed |
| `pnpm test:e2e` (Playwright) | 2 critical-flow scenarios passed: register→onboarding→case→logout→login (data persists); and user isolation (second user cannot see the first user's case) |
| `pnpm worker:dev` + enqueue | live demo: enqueue → worker consumes → idempotent completion → logged outcome (verified in DB + logs) |

RLS tests create real users via the auth admin API and assert, among
others: student A cannot read student B's cases/profiles/events; anon
cannot read any student table; internal tables are service-role only;
granted advisers can read only the granted case; revocation takes effect
immediately.

## 7. Technical debt / known issues

1. **No `httpOnly` auth cookies yet** — the SSR library defaults to
   readable cookies; switch to `httpOnly` cookies in a hardening pass.
2. **E2E not in CI** — Playwright browsers need the runner image; currently
   run locally (documented in the runbook). Add a CI job with
   `mcr.microsoft.com/playwright` when the project hosts its own runners.
3. **Hand-written `Database` type** in `packages/database` must be kept in
   sync with migrations; consider Supabase CLI type generation once
   available in CI.
4. **Seed demo password** is a fixed dev credential; documented as such.
5. **Rate limiting / webhook signature validation** are declared in the
   security doc as planned — not yet implemented (no endpoints need them yet
   beyond AI/ingestion, which are future work).
6. **UCAS integration** is intentionally contract-only (interface + status
   mapping); undocumented third-party APIs are never called.
7. **Personal statement feature** (the original prototype flow) is removed
   from navigation; its replacement — the Document Studio on the artifact
   model — is future work.
8. **`identity_roles` insert-only RLS**: only `student` role is auto-
   provisioned; adviser/administrator role assignment needs a protected
   admin path (future).
9. The local Supabase stack uses the default demo JWT secret; a
   service-role token was minted against it (see runbook).

## 8. Next recommended vertical slice

**Admissions Catalogue + Recommendation Engine v1.** The foundation already
contains the catalogue schema (institutions, courses, intakes, cycles,
effective-dated requirements, sources), the seed data, the deterministic
engine package and the UK adapter skeleton. The natural next step:

1. Build the course catalogue browsing UI (institution → course → intake →
   requirements) over the seeded data.
2. Implement the first real UK rules (level matching, English requirement,
   qualification-system matching) as versioned rule modules.
3. Wire `CourseRecommendation` generation into the dashboard as
   "match my profile" per case, storing the result with profile/catalogue/
   rules versions for reproducibility.
4. Optionally add one real ingestion source (a single UK university course
   page) behind `packages/ingestion` to validate the provenance pipeline.

Alternative next slice: **Document Studio** (artifact-based personal
statement/CV builder with AI generation through `packages/ai`), which
revives the original prototype feature on the correct architecture. I
recommend the catalogue + recommendation slice first, because eligibility
guidance is the product's core differentiator and it validates the
effective-dating and provenance model before user-generated content
depends on it.

---

## Appendix (2026-08-16) — Foundation hardening

Milestone 1 of the implementation programme (see
`docs/product/implementation-roadmap.md`) hardened the foundation:

- Student is now an independent domain entity (canonical `id`, nullable
  auth link, `unclaimed → claimed → closed` lifecycle, adviser-created
  prospects, claiming RPCs) — migrations 0011 + 0016.
- Access grants are scoped per resource (case/document/artifact/profile);
  a document grant no longer exposes the Student 360 — migration 0012.
- Application-case writes are atomic security-definer RPCs with the status
  machine and institution/course/intake/cycle invariants enforced inside one
  transaction — migration 0013.
- `ucs` → `ucas`; UK-centric assumptions removed; qualification systems
  became a lookup; catalogue hardened (slugs, identifiers, cycle-scoped
  fees, verification status, source freshness) — migrations 0014 + 0015.
- Schema grants are re-applied idempotently for restored databases —
  migration 0017.
- CI now starts a fresh Supabase stack and runs `pnpm db:test` and the
  Playwright e2e suite.

Full findings and fixes: `docs/architecture/current-state-audit.md` §13.
Test counts at this point: 36 unit + 67 RLS/integration + 2 e2e, all green.
