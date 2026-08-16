# Security Architecture

This document is the security baseline for Offer.ai. It includes a threat
model and the controls in place (or planned) for each area.

## Principles

- **Never trust the client.** `user_id`, roles and claims sent from the
  browser are ignored; identity comes from the authenticated Supabase session.
- **RLS is the last line of defence for student data**, enforced by the
  database itself; server code additionally checks authorization for
  sensitive operations (defence in depth, not belt-and-braces).
- **Least privilege.** Service-role credentials exist only on servers/worker;
  they are never bundled into client code or exposed to browsers.
- **Private by default.** Student documents are in private storage; no
  permanent public URLs.
- **Secrets are server-only** and validated at startup; missing required
  production configuration fails fast, never silently.

## Environment & secrets

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | browser client (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | server/worker only | admin/service operations |
| `DATABASE_URL` | server/worker only | direct Postgres access for migrations/tests |
| `DEEPSEEK_API_KEY` | server/worker only | AI provider |

- `packages/config` validates the environment with zod at startup
  (`validateEnv()`). The web app validates on server bootstrap; the worker
  validates at process start.
- Never commit real secrets. `.env.example` documents required variables.
- The service-role key must never appear in `NEXT_PUBLIC_*`.

## Threat model

| Threat | Mitigation |
| --- | --- |
| Attacker reads another student's profile/cases | RLS policies keyed on `auth.uid()`; server authorization checks; automated RLS tests |
| Attacker submits rows with a forged `user_id` | Server never trusts client-supplied `user_id`; policies derive identity from the JWT; `auth.uid()` used in policies |
| Attacker accesses student documents | Private storage bucket; owner-scoped policies; expiring signed URLs |
| Attacker exploits exposed service-role key | Key never in client bundles; `.gitignore` covers `.env*`; CI secret scanning |
| Attacker calls admin endpoints | Protected routes require an authenticated session and, where relevant, `administrator` role check |
| Attacker overwhelms AI endpoints | Rate limiting on API routes (planned); AI calls prefer background jobs; request-size limits |
| Attacker submits malformed payloads | zod validation at every application boundary |
| Attacker reuses a stolen session | Supabase Auth session management; session cookies with `sameSite=lax`, `secure` in production (`httpOnly` is a future hardening step — the current cookie adapter uses the SSR library defaults) |
| Malicious webhook payloads | Signature validation before processing (planned with Stripe/ingestion) |
| Secrets in logs | Structured logger with redaction; audit logs never store secrets |
| Dependency vulnerabilities | `pnpm audit` in CI |

## Authentication

- Supabase Auth (email/password; email confirmation enforced in production).
- Server-side session helpers in `apps/web/src/lib/supabase/server.ts`
  (create server client from cookies).
- Browser client in `apps/web/src/lib/supabase/client.ts` (RLS-preserving).
- Protected route architecture: server-side `requireUser()` checks on
  layouts/pages; unauthenticated visitors are redirected to `/login`.
- Session refresh and route protection handled by the request proxy
  (`apps/web/src/proxy.ts` — Next 16 renamed middleware to proxy).

## Authorization

- Roles: `identity_user_roles` (many-to-many). Helper `hasRole(userId, role)`
  in server code. The product is never modelled around a single `role` field.
- Student data access: RLS `auth.uid()` policies + `has_student_access()`
  SECURITY DEFINER function for grants.
- Adviser/guardian access requires an explicit `access_grant` with scope and
  expiry; revocation removes access immediately.
- Administrative mutations only through protected server paths (route
  handlers / server actions) with role checks — never from the client.

## Route handling

Every API route handler follows the pattern:

```text
authenticate → validate (zod) → authorize → call application service → map result
```

Errors are mapped through typed domain errors (`AuthenticationError`,
`AuthorizationError`, `ValidationError`, `NotFoundError`, `ConflictError`,
`EligibilityError`, `ExternalServiceError`, `RateLimitError`); raw database
or provider errors never reach the client.

## Headers & transport

- Production deployments set strict security headers (CSP, HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`).
- HTTPS terminated at the edge; cookies marked secure in production.
  (`httpOnly` cookies are planned hardening — see technical debt in the
  foundation report.)
- Request-size limits on uploads (Supabase Storage enforces; client-side
  pre-check documented in runbook).

## Audit logging

Append-only `audit_logs` for:

- adviser access granted/revoked
- application status changed
- adviser assigned
- recommendation overridden
- application submitted externally
- payment status changed
- administrator actions
- document access where appropriate

Recorded: `actor_id`, `action`, `resource_type`, `resource_id`,
`correlation_id`, `metadata` (no secrets), `created_at`.

## AI safety

- `packages/ai` never lets model output silently mutate canonical student
  records; extracted facts enter the evidence pipeline in
  `unverified`/`machine_extracted` state.
- Every AI run is recorded in `ai_runs` (provider, model, prompt version,
  token usage, status) for auditability and cost control.

## Testing the security boundary

`supabase/tests/` contains automated RLS tests that exercise the policies
with real users:

- student A cannot read student B's profile/cases/documents
- student cannot insert rows with another user's id
- anon cannot read any student table
- adviser with grant can read the granted case only
- revoked grant removes access immediately

Run with `pnpm db:test`.
