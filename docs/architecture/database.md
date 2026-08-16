# Database Architecture

Supabase Postgres is the single source of truth. All schema changes are
migration-controlled in Git (`supabase/migrations/`), never created manually.

## Schema strategy

**Decision: single `public` schema with domain-prefixed table names.**

Rationale (see ADR 0002):

- PostgREST (the Supabase REST API) exposes the `public` schema by default.
  Putting client-facing tables in additional schemas would require
  PostgREST/Kong configuration changes for zero functional benefit at this
  stage.
- Access control is enforced by Row Level Security, not by schema separation.
- Internal tables (`ai_runs`, `background_jobs`, `audit_logs`,
  `source_snapshots`) are client-inaccessible **by policy**: RLS is enabled
  with no `authenticated`/`anon` policies, so the browser client can never
  read or write them.

Naming convention: `domain_table`, e.g. `student_profiles`,
`catalog_courses`, `admissions_cases`, `identity_user_roles`.

## Migration workflow

- Migrations live in `supabase/migrations/` as numbered SQL files
  (`0001_xxx.sql`, `0002_xxx.sql`, …). Timestamps in filenames are avoided
  for predictable ordering.
- `pnpm db:migrate` applies pending migrations in order, in a transaction,
  recording them in `public.schema_migrations`.
- `pnpm db:seed` loads `supabase/seed.sql` (development data only).
- Never edit an applied migration; add a new one. This preserves the ability
  to replay the schema from scratch.

## Table inventory (foundation)

### Identity & organisations

| Table | Purpose |
| --- | --- |
| `identity_roles` | role lookup (`student`, `guardian`, `adviser`, `administrator`, …) |
| `identity_user_roles` | user ↔ role (many-to-many; users may hold multiple roles) |
| `user_preferences` | locale, timezone, currency, communication prefs |
| `organisations` | agencies, solo providers, schools, opportunity providers |
| `organisation_memberships` | user ↔ organisation with role |

### Student 360

| Table | Purpose |
| --- | --- |
| `student_profiles` | canonical student profile root (independent of any application) |
| `student_education` | schools / universities attended |
| `student_qualifications` | qualifications, qualification systems, grades, predicted grades, GPA, language tests |
| `student_experiences` | employment, internships, volunteering, projects, awards, research |
| `student_goals` | study goals, career goals, target countries/levels/subjects |
| `evidence_items` | first-class evidence linking claims to sources; provenance + verification |
| `documents` | uploaded files (owner, storage path, checksum, processing status, version) |
| `access_grants` | explicit grants (adviser/guardian) with scope, expiry, revocation |
| `consents` | consent type, policy version, granted/revoked at, source |

### Admissions catalogue

| Table | Purpose |
| --- | --- |
| `catalog_subjects` | subject taxonomy |
| `catalog_institutions` | universities/colleges |
| `catalog_courses` | courses (level, duration, fees, link to institution/subject) |
| `catalog_course_intakes` | intakes per course |
| `catalog_application_cycles` | application cycles (2026/27, 2027/28, …) |
| `catalog_course_requirements` | effective-dated structured requirements + source text |
| `catalog_sources` | provenance of catalogue facts (official URL, owner, extractor version) |
| `catalog_source_snapshots` | raw snapshots with content hash (immutable) |

### Admissions

| Table | Purpose |
| --- | --- |
| `application_cases` | one student–course–intake–cycle application (current status stored) |
| `application_events` | append-only case history (status changes, decisions, offers) |
| `application_tasks` | first-class tasks (source, assignee, due date, priority, status) |
| `application_case_documents` | case ↔ document links with purpose |

### Artifacts

| Table | Purpose |
| --- | --- |
| `artifacts` | CV, personal statement, SOP, supplementary answer, reference draft… |
| `artifact_versions` | versioned content (creator, AI/human origin, prompt version, approval state) |

### Platform

| Table | Purpose |
| --- | --- |
| `audit_logs` | append-only audit (actor, action, resource, correlation id) — service-role only |
| `ai_runs` | AI execution ledger (provider, model, prompt_version, tokens, cost, status) — service-role only |
| `background_jobs` | durable job queue (idempotency key, status, attempts, correlation id) — service-role only |

## Conventions

- UUID primary keys everywhere (`gen_random_uuid()`).
- Foreign keys with explicit `ON DELETE` behaviour.
- `CHECK` constraints for bounded value sets and useful invariants.
- `NOT NULL` used intentionally; nullable columns mean "unknown", documented
  in the migration.
- Unique constraints only for genuine identity.
- JSONB only for genuinely flexible metadata; relational columns for
  searchable/comparable data (qualifications, grades, dates).
- **No database enums.** Business states use `text` + `CHECK` so they can
  evolve without `ALTER TYPE` lock friction.
- All timestamps are `timestamptz`, defaulting to `now()`.

## Effective dating

Catalogue requirement records carry:

```text
effective_from, effective_to, observed_at, published_at, superseded_by
```

A student's application is evaluated against the requirements that were
effective for their cycle — never against whatever is current at query time.

## Provenance statuses

```text
unverified → machine_extracted → machine_validated → human_verified
         ↘ superseded / rejected
```

LLM output alone can never reach `human_verified`; student or adviser
confirmation is required.

## Indexing

Every foreign key is indexed. Additional indexes cover the hot query
patterns of the vertical slice:

- `application_cases (student_id, created_at desc)`
- `application_events (case_id, created_at asc)`
- `background_jobs (status, available_at)` for queue polling
- `ai_runs (student_id, created_at desc)`

## Row Level Security

RLS is **enabled on every table** that can hold student data. Policy rules:

- A student can access their own rows: `auth.uid() = student_id`
  (for tables keyed by student) or `auth.uid() = user_id`.
- Adviser/guardian access flows through `has_student_access(target_student_id)`
  — a `SECURITY DEFINER` helper that consults active `access_grants`; it is
  used inside policies so RLS is never bypassed by the client.
- Catalogue tables are readable by `anon` and `authenticated` (public
  information), writable only by the service role.
- `audit_logs`, `ai_runs`, `background_jobs`, `catalog_source_snapshots`:
  no client policies — service-role only.
- The service-role key (server/worker only) bypasses RLS by design.

RLS policies are exercised by automated tests in `supabase/tests/` (see
`docs/architecture/security.md` and the testing section).

## Storage

- Private bucket `student-documents` (created by migration).
- Storage objects are never served with permanent public URLs; access is via
  authenticated, expiring signed URLs.
- Object owner = uploading user; policies mirror RLS (owner read/write,
  granted adviser read where applicable).

## Seed data

`supabase/seed.sql` provides safe, clearly-fake development data:

- one demo student
- a handful of subjects, one institution, a few courses with intakes
- one application cycle
- sample course requirements (effective-dated)
- one example application case with events and tasks

No real personal data ever enters seed files.
