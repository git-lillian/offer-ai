# Offer.ai — Domain Map

This document maps the business domains of Offer.ai, where they live in the
codebase, and which parts are implemented in the foundation vs. future work.

## Bounded contexts

| Domain | Responsibility | Package / area | Foundation status |
| --- | --- | --- | --- |
| Identity | authentication, account, user roles, preferences, locale, timezone, account state | `packages/domain` (types), Supabase Auth, `apps/web` auth helpers | Implemented (auth flow, roles) |
| Organisations | agencies, solo consultants, schools, opportunity providers, memberships | `packages/domain` (types), database tables | Tables + types; no UI |
| Student 360 | canonical student entity (independent of auth), profile, academic history, qualifications, experiences, goals, claiming | `packages/domain`, database `students` schema | Implemented (independent entity, prospect creation + claiming, scoped grants, international qualifications) |
| Evidence | first-class EvidenceItem for every student claim, provenance, verification state | `packages/domain`, database `evidence` tables | Tables + types |
| Documents | private file storage, uploads, processing status, extraction | Supabase Storage (private bucket), `packages/domain` | Bucket + policies + types; no upload UI yet |
| Admissions catalogue | institutions, courses, intakes, cycles, requirements, effective dating, provenance, identifiers | `packages/admissions-engine` (future), database `catalog` schema | Tables hardened (slugs, identifiers, cycle-scoped fees, verification status); seed data; no ingestion |
| Admissions engine | eligibility, recommendations, strategy | `packages/admissions-engine` | Interfaces + UK adapter skeleton; rules v1 minimal |
| Application cases | case lifecycle, events, tasks, documents, decisions, offers | `packages/domain`, database `admissions` schema | Implemented (atomic create/transition RPCs, append-only events, UCAS route) |
| Artifacts | CV, personal statement, SOP, supplementary answers — generic versioned model | `packages/domain`, database `artifacts` schema | Tables + types; generation in future |
| AI | provider abstraction, model routing, prompts, usage ledger | `packages/ai` | Implemented (provider, DeepSeek adapter, ledger table) |
| Marketplace | provider profiles, services, bookings, orders, reviews, commissions | `packages/domain` (types), database | Types only |
| Billing | subscriptions vs marketplace transactions, entitlements | `packages/billing` | Types only |
| Experience builder | opportunities (internships, volunteering, courses…) | `packages/domain` (types), database | Types only |
| Content intelligence | structured change events (deadline changed, course opened…) | future | — |
| Ingestion | source registry → fetch → extract → normalize → publish | `packages/ingestion` | Interfaces only; no crawler |
| Background jobs | durable job queue, retries, idempotency | `packages/database` (queue tables), `apps/worker` | Implemented (Postgres queue + worker) |
| Audit | append-only audit of important actions | database `audit` schema, `packages/domain` types | Implemented |
| Consent | consent records with policy version, grant/revoke | `packages/domain`, database | Implemented |
| Notifications | future notification delivery | `packages/notifications` | Interfaces only |

## Dependency direction

```text
domain (pure, framework-free)
  ↑
admissions-engine, ai, ingestion, billing, notifications (depend on domain)
  ↑
database (repositories)        contracts (DTOs)
  ↑
apps/web, apps/worker (delivery, depend on all of the above)
```

`packages/domain` must not import: Next.js, React, Supabase SDK, Stripe SDK,
AI SDKs, or any HTTP framework.

## Key entities

### Student 360

- `StudentProfile` (root profile; canonical `id` independent of any
  application or auth account; `unclaimed → claimed → closed` lifecycle;
  `created_by_user_id` for adviser/guardian-created prospects)
- `StudentEducation`, `StudentQualification` (with explicit GPA scale),
  `StudentExperience`
- `QualificationSystem` (extensible national-systems lookup)
- `EvidenceItem` (provenance: source_type, verification_status, verified_by/at)
- `Document` (owner, storage path, checksum, processing status, version)
- `AccessGrant` (scope: profile/case/document/artifact/service + resource id)

### Admissions catalogue

- `Institution`, `Course` (slugs, application routes), `CourseIntake`
  (cycle-scoped fees, deadline provenance), `ApplicationCycle`
- `CourseRequirement` (effective-dated, structured values + source text,
  verification status)
- `Source` / `SourceSnapshot` (provenance of every catalogue fact)
- `CatalogEntityIdentifier` (UCAS codes, UKPRN, HESA identifiers)

### Application case

- `ApplicationCase` (student, course, intake, cycle, route `ucas | institution_direct | agent_portal | other`, status)
- `ApplicationEvent` (append-only status/event history; writes only through controlled RPCs)
- `ApplicationTask` (first-class, with source, assignee, due date, status)
- `ApplicationDocument`, `AccessGrant`, `Consent`

### Artifacts

- `Artifact` (cv, personal_statement, statement_of_purpose, …)
- `ArtifactVersion` (content, creator, AI/human origin, prompt version, approval state)

### Identity & organisations

- `UserRole` (multiple roles per user: student, guardian, adviser, …)
- `Organisation`, `OrganisationMembership`

### Audit

- `AuditLogEntry` (actor, action, resource, correlation id, metadata)

## Cross-cutting concepts

- **Effective dating** — catalogue requirements carry `effective_from/to`,
  `observed_at`, `published_at`, `superseded_by`.
- **Provenance statuses** — unverified / machine_extracted / machine_validated /
  human_verified / superseded / rejected. LLM output alone is never
  `human_verified`.
- **RLS everywhere** — every student-adjacent table has Row Level Security
  policies; the client never bypasses them.
