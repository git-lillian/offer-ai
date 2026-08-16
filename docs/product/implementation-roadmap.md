# Implementation Roadmap

> Living handoff document for autonomous development sessions. Each milestone
> records its branch, PR, merge commit, key capabilities, known limitations
> and what comes next. **Start here** before reading other docs.

## Status summary

| Milestone | Status | Branch | PR | Merge commit |
| --- | --- | --- | --- | --- |
| 1. Foundation hardening | ✅ merged | `chore/foundation-hardening` | #2 | see below |
| 2. UK admissions catalogue v1 | ⏳ next | — | — | — |
| 3. Real UK ingestion v1 | — | — | — | — |
| 4. Recommendation engine v1 | — | — | — | — |
| 5. Application OS v1 | — | — | — | — |
| 6. Document studio v1 | — | — | — | — |
| 7. AI admissions adviser v1 | — | — | — | — |
| 8. Experience builder v1 | — | — | — | — |
| 9. Human expert marketplace v1 | — | — | — | — |
| 10. Billing & marketplace payments | — | — | — | — |
| 11. Notifications & deadline engine | — | — | — | — |
| 12. Product quality / commercial readiness | — | — | — | — |
| 13. Final architecture & security review | — | — | — | — |

---

## Milestone 1 — Foundation hardening (complete)

**Branch:** `chore/foundation-hardening` — **PR:** #2 — **Merge:** latest on `main`.

### What was delivered

- **Student is an independent domain entity.** `student_profiles.id` is the
  canonical student id; `user_id` is a nullable link to the claimed auth
  account. Lifecycle `unclaimed → claimed → closed`. Supports guardian-created
  students, adviser-created prospects (`create_prospect` RPC), claiming via
  signup email-match or `claim_student_profile` RPC, and multiple scoped
  access relationships. Migrations 0011, 0016.
- **Scoped access.** `access_grants` carry `scope` (`profile`, `case`,
  `document`, `artifact`, `service`) + optional `scope_id`; each resource
  table's RLS checks only its own scope. A document grant no longer exposes
  the Student 360; a case grant no longer exposes other applications.
  Migration 0012.
- **Atomic ApplicationCase operations.** `create_application_case`,
  `transition_application_case`, `append_application_event` are
  security-definer RPCs that enforce the status machine and the
  institution↔course↔intake↔cycle invariants inside one transaction.
  Client-side direct writes are blocked by RLS. Migration 0013.
- **`ucs` → `ucas`** everywhere (data fix, CHECK constraint, domain, seed).
- **Student 360 structural hardening.** Removed UK-centric defaults (entry
  year window, GB country defaults, UK locale/timezone/currency defaults);
  qualification systems are now a lookup table; GPA scale is explicit.
  Migration 0014.
- **Catalogue hardening.** Slugs, polymorphic external identifiers,
  cycle-scoped fees with provenance, requirement verification status, source
  freshness, per-course application routes. Migration 0015.
- **No volatile facts in code.** UK adapter no longer hard-codes UCAS
  deadlines; deadlines belong in the catalogue with provenance.
- **CI genuinely functional.** `integration` (fresh Supabase stack via
  `supabase/setup-cli`, migrations, seed, `pnpm db:test`) and `e2e` jobs added;
  `supabase/config.toml` for the CLI stack; pnpm 11 `allowBuilds` fixed.
- **Architecture audit** recorded in
  `docs/architecture/current-state-audit.md` §13, with fixes for: a
  `next/headers` layer violation in `packages/database`, PostgREST
  `return=representation` + security-definer policy quirk, lost schema ACLs on
  restored DBs, undeclared dependencies, broken build-script allowlist.

### Migrations added

`0011_student_identity`, `0012_scoped_access_rls`, `0013_atomic_application_cases`,
`0014_student_360_hardening`, `0015_catalogue_hardening`,
`0016_controlled_prospect_creation`, `0017_standard_schema_grants`.

### Verification

`pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (36) · `pnpm db:test` ✅ (67)
· `pnpm build` ✅ · `pnpm test:e2e` ✅ (2)

### Known limitations

- No catalogue browsing UI yet (next milestone).
- Adviser/guardian workflows have no UI; RPCs + tests only.
- `claim_student_profile` is exercised for unlinked accounts; the signup
  email-match path covers the common adviser→student handoff.
- The RLS tests rely on the seed catalogue for the e2e course selection;
  the RLS suite cleans up its fixtures.

### Next milestone

**UK admissions catalogue v1** — browseable `/universities`,
`/universities/[institutionSlug]`, `/universities/[institutionSlug]/courses/[courseSlug]`
with PostgreSQL search/filtering, pagination, source provenance display,
and a seed catalogue with honest provenance labels.

---

## Milestone 2 — UK admissions catalogue v1

*Not started.* (Plan: routes above; search/filter via Postgres `ILIKE` +
indexed columns; provenance display "Source: … / Last checked: …"; seed data
marked as development fixtures where fabricated.)
