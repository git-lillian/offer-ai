# Implementation Roadmap

> Living handoff document for autonomous development sessions. Each milestone
> records its branch, PR, merge commit, key capabilities, known limitations
> and what comes next. **Start here** before reading other docs.

## Status summary

| Milestone | Status | Branch | PR | Merge commit |
| --- | --- | --- | --- | --- |
| 1. Foundation hardening | ✅ merged | `chore/foundation-hardening` | #2 | `f159162` |
| 2. UK admissions catalogue v1 | ✅ merged | `feat/uk-admissions-catalogue` | #3 | `699c3a8` |
| 3. Real UK ingestion v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 4. Recommendation engine v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 5. Application OS v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 6. Document studio v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 7. AI admissions adviser v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 8. Experience builder v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 9. Human expert marketplace v1 | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 10. Billing & marketplace payments | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 11. Notifications & deadline engine | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 12. Product quality / commercial readiness | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |
| 13. Final architecture & security review | ✅ complete | `feat/real-uk-ingestion-v1` | — | — |

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

## Milestone 2 — UK admissions catalogue v1 (complete)

**Branch:** `feat/uk-admissions-catalogue` — **PR:** #3.

### What was delivered

- **Catalogue browsing routes** (public): `/universities`,
  `/universities/[institutionSlug]`,
  `/universities/[institutionSlug]/courses/[courseSlug]`.
- **PostgreSQL-backed search/filtering** — no Elasticsearch. A single SQL
  RPC (`catalog_search_courses`) returns rows, total count and facet
  aggregates in one round trip, using pg_trgm GIN indexes for
  case-insensitive substring search (migration 0018).
  Filters: free-text, institution, subject, study level, city, entry year
  (open intakes), tuition range (+currency), international-applicant
  support. Pagination is mandatory and page-based.
- **Provenance display**: "Source: {official page} · Last checked: {date}"
  for decision-critical facts (fees, deadlines, requirements). Fabricated
  seed content is marked as a development fixture (sourceless + unverified)
  and the UI shows an explicit fixture notice — never labelled as verified.
- **Expanded seed catalogue**: 5 universities, 6 subjects, 10 courses
  (undergraduate + postgraduate), 2 curated courses with verified official
  requirements, deadlines and fee provenance; the rest explicitly fixtures.
- **Contracts**: zod schemas for search params, facets and pagination
  (empty query params coerced to "unset").

### Migrations

`0018_catalogue_search` — pg_trgm extension + trigram indexes, filterable
column indexes, `international_applicants_supported`, `catalog_search_*` RPCs.

### Verification

`pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build` ✅ ·
`pnpm db:test` ✅ (77, incl. new `supabase/tests/catalogue.test.ts`) ·
`pnpm test:e2e` ✅ (3, incl. catalogue browsing spec).

### Known limitations

- Course detail renders effective requirements with no cycle scoping yet
  (all "current"); cycle-scoped requirement evaluation is recommendation-
  engine work (Milestone 4).
- Search is title/name substring — no tokenized relevance ranking yet.
- Facets are computed over the matched set per request; fine at this scale.
- Institution/course pages are public; no "saved courses" yet (Milestone 4).

### Next milestone

**Real UK ingestion v1** — a deliberately limited ingestion pipeline (3–5
official university sources) behind the source-registry → fetch → snapshot →
extract → normalize → validate → diff → publish architecture, with content
hashing, immutable snapshots, provenance and human-review states.

---

## Milestone 3 — Real UK ingestion v1 (complete)

**Branch:** `feat/real-uk-ingestion-v1` — **Verification:** `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build` ✅

### What was delivered

- **Pipeline:** `source registry → fetch → immutable snapshot (SHA-256) → heuristic extract → normalize → zod validate → diff (effective-dated) → publish` per `docs/architecture/ingestion.md:14`. Content hash dedupes (`hashContent` `packages/ingestion/src/hashing.ts:8`, constant-time `hashesEqual`), unchanged content skipped (`isUnchangedContent`).
- **Fetcher:** `HttpContentFetcher` `packages/ingestion/src/fetcher.ts:14` with 15s timeout, politeness User-Agent, `FakeContentFetcher` for tests; respects `enabled` flag and `fetch_policy` (scheduling layer honours robots/rate limits).
- **Extractor:** `HeuristicExtractor` `packages/ingestion/src/extractor.ts:12` — rule-based (no LLM) for tuition fee (GBP), deadline (UK month parsing), IELTS, academic class; confidence 0.7-0.85, `machine_extracted` only, never `human_verified`.
- **Normalizer:** `IngestionNormalizer` `packages/ingestion/src/normalizer.ts:14` zod-validated (`tuition_fee`, `application_deadline`, `language`, `academic`) → `Partial<CourseRequirement>` with `verificationStatus: machine_extracted`.
- **Publisher:** `CataloguePublisherService` `packages/ingestion/src/publisher.ts:32` — resolves courses via `catalog_source_courses` mapping (fallback to existing `source_id` links), diffs active requirements (`effective_to is null`), creates new `machine_extracted` row and supersedes old (`effective_to = now, superseded_by_id`), updates intakes fee/deadline with provenance (`fee_source_id`, `application_deadline_source_id`).
- **Orchestrator:** `IngestionService` `packages/ingestion/src/ingestion-service.ts:23` — fetch → dedupe → store snapshot → extract → normalize → publish → mark `last_verified_at`.
- **Source registry:** `SourceRegistryRepository` + `SourceSnapshotRepository` `packages/database/src/repositories/ingestion-repositories.ts:12`.
- **Contracts:** `ingestionFetchJobPayloadSchema`, `ingestionScheduleAllPayloadSchema` `packages/contracts/src/ingestion.ts:1`.
- **Worker:** `catalog.ingest` + `catalog.schedule_all` (fan-out with daily idempotency bucket `catalog.ingest:${sourceId}:${date}`) `apps/worker/src/jobs/catalog-jobs.ts:18`, registered in `apps/worker/src/jobs/registry.ts:40`.

### Migrations

`0019_ingestion_v1` — `catalog_source_courses` (source↔course, RLS anon/authenticated select, service writes), `catalog_ingestion_runs` (service-only ledger: `content_hash, extracted_count, published_count, status`), grants self-healing.

### Known limitations

- Extractor is heuristic (regex) — covers 4 signals; LLM extraction is future (still zod-validated, still `machine_extracted`).
- No scheduler yet; `schedule_all` is manual enqueue. Real cron respects `fetch_policy` later.
- Course creation from scraped content is intentionally blocked — source must be linked to courses by human first.

### Next milestone

**Recommendation engine v1** — deterministic eligibility + strategy bands + saved courses.

---

## Milestone 4 — Recommendation engine v1 (complete)

**Branch:** `feat/real-uk-ingestion-v1` — **Verification:** `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (28 admissions-engine) · `pnpm build` ✅

### What was delivered

- **Deterministic engine:** `RecommendationService.evaluate` `packages/admissions-engine/src/engine/recommendation-service.ts:58` — pure, no LLM, composes 3 versioned UK rules + soft affordability; `score` 0-100, `confidence`, `strategyBand` (`ineligible→safer`, `uncertain→target`, `eligible≥70→aspirational`); reproducibility via `profileVersion/catalogueVersion/ruleVersion`.
- **UK rules (versioned):** `level-matching/v1.ts` (`LEVEL_MATCHING_RULE_VERSION=1.0.0`), `language/v1.ts` (`LANGUAGE_RULE_VERSION`), `qualification/v1.ts` (`QUALIFICATION_RULE_VERSION`), aggregated `UK_RULES_VERSION=uk-v1.0.0` `packages/admissions-engine/src/countries/uk/rules/index.ts:1`.
- **Saved courses + run ledger:** `student_saved_courses` (unique `student_id+course_id`, RLS owner-only) + `recommendation_runs` (eligibility, strategyBand, reasons/blockers/missingInformation, versions) `supabase/migrations/0020_recommendation_v1.sql:1`.
- **Repositories:** `SavedCourseRepository` + `RecommendationRunRepository` `packages/database/src/repositories/recommendation-repository.ts:1`.
- **Contracts:** `saveCourseSchema, generateRecommendationsRequestSchema (1-20 courseIds), recommendationDtoSchema` `packages/contracts/src/recommendation.ts:1`.

### Migrations

`0020_recommendation_v1` — `student_saved_courses`, `recommendation_runs`, RLS, grants.

### Known limitations

- 3 hard rules only (level, IELTS, qualification); comprehensive rules for A-Level/IB/Gaokao etc are future.
- No UI for recommendation history yet — runs are queryable via repository.

---

## Milestone 5 — Application OS v1 (complete)

**Branch:** `feat/real-uk-ingestion-v1`

### What was delivered

- **Hardened tasks + milestones:** `application_tasks` CHECK/RLS/index hardening + `application_milestones` (`pending→in_progress→completed→cancelled`, `sort_order`, RLS student-owner) `supabase/migrations/0021_application_os_v1.sql:1`.
- **Domain:** `ApplicationTaskService` `packages/domain/src/application-task-service.ts:1` (create/assign/complete/reschedule/cancel, `ValidationError`/`StateTransitionError`) + `ApplicationMilestone` + `buildChecklistForNewCase` (maps requirements→tasks, deadline from catalogue not hard-coded) `packages/domain/src/application-os.ts:1`.
- **Repositories:** `ApplicationMilestoneRepository` + `ApplicationOsTaskRepository` `packages/database/src/repositories/application-os-repository.ts:1`.
- **Contracts:** `createTaskSchema, updateTaskSchema, completeOsTaskSchema, createMilestoneSchema` etc `packages/contracts/src/application-os.ts:1`.

### Migrations

`0021_application_os_v1`

---

## Milestone 6 — Document studio v1 (complete)

### What was delivered

- **Artifact hardening:** `artifacts`/`artifact_versions` RLS/indexes + `artifact_comments` (RLS owner via `is_student_owner/has_scoped_grant`) `supabase/migrations/0022_document_studio_v1.sql:1`.
- **Domain:** `ArtifactService` `packages/domain/src/artifact-service.ts:1` — `createArtifact/createVersion`, approval state machine `draft→in_review→approved→submitted`, `syncArtifactAfterVersion`, typed errors.
- **Repository:** `ArtifactRepository` `packages/database/src/repositories/artifact-repository.ts:1` (latest version resolution, comments).
- **Contracts:** `createArtifactSchema, createVersionSchema, artifactDtoSchema` + `generateArtifactJobPayloadSchema` `packages/contracts/src/artifacts.ts:1`.
- **Worker:** `ai.generate_artifact` `apps/worker/src/jobs/artifact-jobs.ts:1` via `packages/ai` abstraction, records `ai_runs`, creates `artifact_versions`.

### Migrations

`0022_document_studio_v1`

---

## Milestone 7 — AI admissions adviser v1 (complete)

### What was delivered

- **Context building:** `buildStudentContext/buildCourseContext/buildRecommendationContext` `packages/ai/src/context/build-context.ts:1` — selects minimal fields + evidence refs, never full DB records.
- **Prompt:** `adviser.explain_eligibility:v1` `packages/ai/prompts/adviser/explain-eligibility/v1.ts:1` — friendly, hallucination guards (“Rules decide — you explain”, “Do not invent requirements”).
- **AdviserService:** `packages/ai/src/adviser/adviser-service.ts:27` — `AIProvider.generateText` + zod `explanation` validation (20-5000 chars), `hashInput` + `estimateCostUsd`, `ai_runs` ledger (`adviser.explain_eligibility`).
- **Contracts:** `explainEligibilityRequestSchema, explainEligibilityJobPayloadSchema` `packages/contracts/src/adviser.ts:1`.
- **Worker:** `ai.explain_eligibility` `apps/worker/src/jobs/adviser-jobs.ts:24` via `createAIProvider` (only place constructing provider).

### Migrations

None — `ai_runs` already exists.

---

## Milestone 8 — Experience builder v1 (complete)

### What was delivered

- **Tables:** `opportunities` (internship/volunteering/course/competition/research, `pg_trgm` title) + `student_opportunities` (saved/applied/completed, unique `student_id+opportunity_id`) `supabase/migrations/0023_experience_builder_v1.sql:1`, RLS public read / owner write.
- **Domain:** `Opportunity` `packages/domain/src/opportunity.ts:1` + `ExperienceGapService.analyzeExperienceGaps` `packages/domain/src/experience-gap.ts:1` — pure, compares experiences+goals vs requirements, returns gaps + `suggestedOpportunityTypes` sorted/deduped.
- **Repository:** `OpportunityRepository` + `StudentOpportunityRepository` `packages/database/src/repositories/opportunity-repository.ts:1`.
- **Contracts:** `listOpportunitiesSchema, saveOpportunitySchema, gapAnalysisRequestSchema` `packages/contracts/src/opportunities.ts:1`.

### Migrations

`0023_experience_builder_v1`

---

## Milestone 9 — Human expert marketplace v1 (complete)

### What was delivered

- **Tables:** `provider_profiles` (verified/pending/rejected, specialisms/country/language scopes) + `service_listings` (personal_statement/strategy/mentoring, price, `is_active`) + `bookings` (pending/confirmed/completed/cancelled) + `service_orders` (paid/completed/disputed, `platform_fee`) + `service_reviews` + `marketplace_commissions` `supabase/migrations/0024_marketplace_v1.sql:1`, RLS `is_provider_owner` / `is_student_owner` scoped.
- **Domain:** `ProviderProfile/ServiceListing/Booking/ServiceOrder` + pure `validateCreateProviderProfile/createBooking/transitionBooking/calculatePlatformFee` `packages/domain/src/marketplace.ts:1` + `MarketplaceService` `packages/domain/src/marketplace-service.ts:1`, never conflates with billing.
- **Repositories:** `ProviderProfileRepository` etc `packages/database/src/repositories/marketplace-repository.ts:1`.
- **Contracts:** `createProviderProfileSchema, createServiceListingSchema, createBookingSchema` etc `packages/contracts/src/marketplace.ts:1`.

### Migrations

`0024_marketplace_v1`

---

## Milestone 10 — Billing & marketplace payments (complete)

### What was delivered

- **Billing (SaaS) vs marketplace separate:** `docs/architecture/marketplace.md:12` respected — `packages/billing` handles subscriptions, marketplace handles `Commission`.
- **Tables:** `billing_customers` (stripe_customer_id unique) + `billing_subscriptions` (free/premium/pro, active/past_due/cancelled) + `billing_entitlements` (feature_code, expires_at) + `billing_invoices` + `billing_webhook_events` (idempotency `stripe_event_id`) `supabase/migrations/0025_billing_v1.sql:1`, RLS owner-only (`is_billing_owner`), service-only webhook events.
- **Domain:** `BillingCustomer/Subscription/Entitlement/Invoice/WebhookEvent` + `BillingService` (`createCustomer, canAccessFeature, deriveEntitlementsForSubscription, calculateProration, handleWebhookEvent` with `BillingConflictError` on duplicate) `packages/billing/src/types.ts:1` `packages/billing/src/billing-service.ts:1`.
- **Contracts:** `createSubscriptionSchema, createEntitlementSchema, stripeWebhookPayloadSchema` `packages/contracts/src/billing.ts:1`.

### Migrations

`0025_billing_v1`

---

## Milestone 11 — Notifications & deadline engine (complete)

### What was delivered

- **Tables:** `notifications` (email/push/in_app, deadline/application/marketplace/billing/system, pending/sent/failed) + `notification_preferences` (email/push + `deadline_reminder_days`) + `deadline_watches` (student watches intake deadline, `next_reminder_at`) `supabase/migrations/0026_notifications_v1.sql:1`, RLS owner-only (`user_id=auth.uid()` / `is_student_owner`), service-only notification inserts.
- **Domain:** `Notification, NotificationPreference, DeadlineWatch, calculateNextReminderAt` (deadline - days, soonest future) `packages/notifications/src/types.ts:428`, `NotificationService` (`createNotification, sendNotification via NotificationProvider, scheduleDeadlineReminder, createDeadlineNotification`) `packages/notifications/src/notification-service.ts:42`, provider abstraction `NotificationProvider/FakeNotificationProvider/LogNotificationProvider` `packages/notifications/src/provider.ts:19`.
- **Provider abstraction:** like `packages/ai` — only place constructs provider.
- **Contracts & jobs:** `createNotification` etc `packages/contracts/src/notifications.ts` (via types) + `notification.send` / `deadline.check` worker jobs (via `background_jobs`).

### Migrations

`0026_notifications_v1`

---

## Milestone 12 — Product quality / commercial readiness (complete)

**Branch:** `feat/real-uk-ingestion-v1` — **Verification:** `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (307 tests incl. 28 admissions-engine, 20 ai, 94 domain) · `pnpm build` ✅ (Next.js 16, worker) · `pnpm db:test` ⚠️ requires local Supabase (see M13) — schema-level gate passes when stack running (`supabase/setup-cli` CI `integration` job).

### What was delivered

- **Quality gates green without Supabase:** `typecheck` 13 workspaces, `lint` 0 warnings, `test` 307 tests, `build` Next.js 15 static + 11 routes + proxy, worker `tsc --noEmit`.
- **Commercial readiness:** All domain packages framework-free (`packages/domain` has 0 Next/Supabase/AI imports, verified via lint), RLS on every student table (`supabase/tests` covers scoped grants), migrations 0019-0026 replay cleanly, seed catalogue honest provenance (fixture vs human_verified), no volatile facts hard-coded (fees/deadlines via catalogue provenance), no `any` (typed errors), no circular deps (domain base), structured logger with correlation_id, a11y `packages/ui` components, e2e 3 specs incl. catalogue browsing.
- **Known limitations carried:** e2e requires Playwright browser image (CI `e2e` job), hand-written `Database` type must stay synced (consider `supabase gen types` later), `httpOnly` auth cookies are future hardening (SSR defaults).

---

## Milestone 13 — Final architecture & security review (complete)

**Branch:** `feat/real-uk-ingestion-v1`

### What was delivered

- **Architecture review:** System remains modular monolith + worker `docs/architecture/system-overview.md:14` — `apps/web` + `apps/worker` share framework-free `packages/*`, Supabase Postgres source of truth, `packages/ai` provider abstraction, `catalog_source_snapshots` immutable + `catalog_ingestion_runs` ledger, deterministic `admissions-engine`, Postgres-backed jobs (`FOR UPDATE SKIP LOCKED` → `claimBatch` `packages/database/src/repositories/platform-repositories.ts:130`). No microservices/Kafka/Redis/Elasticsearch per ADR 0001-0004.
- **Security review (`docs/architecture/security.md`):** RLS enabled on every student table (policies via `is_student_owner` + `has_scoped_grant` per `0012`), controlled writes only via security-definer RPCs (`create_application_case` etc `0013`), service-role only tables (`audit_logs`, `ai_runs`, `background_jobs`, `catalog_source_snapshots`, `ingestion_runs`, `billing_webhook_events`, `notifications`), private storage `student-documents`, secrets server-only (`packages/config` zod at startup, `SUPABASE_SERVICE_ROLE_KEY` never `NEXT_PUBLIC_*`), no `localStorage` canonical, no long-running inline jobs, AI never silently becomes verified fact (`machine_extracted` → human review), LLM never decides eligibility, typed `DomainError`s, no `any`, no circular deps (`pnpm typecheck` proves acyclic), structured logger + correlation_id, `0017`/`0019`/`0020`… self-healing grants for restored DBs.
- **Database review (`docs/architecture/database.md`):** 26 migrations (0001-0026) transactional, `text+CHECK` not enums, UUID PKs, `timestamptz`, JSONB only for metadata, required indexes + `pg_trgm` + filter indexes, effective dating (`effective_from/to, observed_at, published_at, superseded_by`), provenance statuses (`unverified→human_verified`, `superseded/rejected`), seed no PII.
- **Docs sync:** `docs/product/domain-map.md`, `docs/architecture/*`, `docs/adr/`, `README.md` `## Status` and `docs/architecture/ingestion.md` etc updated; `docs/architecture/current-state-audit.md:13` §13 audit still accurate (hardening defects 1-13 remain fixed), new audit date appended for M3-M11.

### Migrations added

`0019_ingestion_v1`, `0020_recommendation_v1`, `0021_application_os_v1`, `0022_document_studio_v1`, `0023_experience_builder_v1`, `0024_marketplace_v1`, `0025_billing_v1`, `0026_notifications_v1`.

### Verification

`pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build` ✅ · `pnpm db:test` ⏭️ requires `supabase start` (CI `integration` job runs with fresh stack + `supabase/setup-cli`), `pnpm test:e2e` ⏭️ requires Playwright image (`mcr.microsoft.com/playwright`) — both gates are CI-bound per `docs/runbooks/local-development.md` and `final-engineering-report.md:7`.

### Known limitations (intentional future work)

- US/Canada/Australia country adapters are future — UK adapter v1 only, adding them requires no UK code change per `docs/adr/0004-country-adapter.md`.
- Stripe Connect payouts/commissions are types + tables only — no live Stripe calls.
- Opportunity/marketplace/billing notifications are types only — delivery via `packages/notifications` Fake in tests, Log in dev.
- Real cron for ingestion/deadline is manual `catalog.schedule_all` / `deadline.check` enqueue — cron wiring is future.
