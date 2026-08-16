# Current State Audit

> Written during the foundation phase (2026-08-15) after a full inspection of the
> repository. This document records what exists, what is missing, and what must
> change. It is a factual snapshot — nothing here is aspirational.

## 1. Repository overview

- Git repo: `git-lillian/offer-ai`, branch `main`, 13 commits, starts from a
  `create-next-app` bootstrap.
- Working tree is a **single Next.js application at the repository root**.
- Package manager: **npm** (`package-lock.json`), Node v24 runtime available
  locally, pnpm 11 available.
- No monorepo, no packages directory, no apps directory, no Turborepo.

### Git history summary

| Commit | Content |
| --- | --- |
| `e22d3af` | Create Next App bootstrap (default README, placeholder landing page) |
| `1fe8135` | Landing page navigation |
| `291c2d9` | Add landing page navigation |
| `154c7a8` | Add initial application pages |
| `c521bc0` | Build login and registration interfaces |
| `f617266` | Add homepage navigation |
| `75774e9` | Set up Supabase client |
| `b33f405` | Build personal statement application wizard |
| `8bccb3b` | Add personal statement review step |
| `0eed2bf` | update |
| `f31c21e` | Add personal statement draft result page |
| `f9b4ede` | Add authentication, AI generation and human review option |
| `7876860` | Add human review order submission |

## 2. Package dependencies (`package.json`)

Production dependencies:

- `next@16.2.10` (App Router, React 19)
- `react@19.2.4`, `react-dom@19.2.4`
- `@supabase/ssr@^0.12.3`, `@supabase/supabase-js@^2.110.5`
- `openai@^7.4.0` (used directly for the DeepSeek integration)

Dev dependencies:

- `typescript@^5`, `eslint@^9`, `eslint-config-next@16.2.10`
- `tailwindcss@^4`, `@tailwindcss/postcss@^4`
- `@types/node@^20`, `@types/react@^19`, `@types/react-dom@^19`

**Not present (and needed):** test framework (vitest/jest/playwright), zod,
pino or another structured logger, a queue/worker library, tsup for building
packages, Turbo. **Not present (deliberately avoided):** ORM, Redis, Kafka,
Elasticsearch, GraphQL.

## 3. Scripts

- `npm run dev` — `next dev`
- `npm run build` — `next build`
- `npm run start` — `next start`
- `npm run lint` — `eslint`

No `test` or `typecheck` scripts exist.

## 4. Directory tree

```text
├── public/                    # default create-next-app svgs
├── src/
│   ├── app/
│   │   ├── api/generate-personal-statement/route.ts   # EMPTY in working tree
│   │   ├── application/personal-statement/            # wizard
│   │   │   ├── page.tsx                               # 4-step questionnaire
│   │   │   ├── result/page.tsx                        # AI draft page
│   │   │   └── human-review/page.tsx                  # review order form
│   │   ├── how-it-works/page.tsx                      # placeholder heading
│   │   ├── pricing/page.tsx                           # placeholder heading
│   │   ├── login/page.tsx                             # client-side login
│   │   ├── register/page.tsx                          # client-side signup
│   │   ├── layout.tsx                                 # root layout (Geist)
│   │   ├── page.tsx                                   # landing page
│   │   └── globals.css                                # tailwind v4 import
│   ├── components/
│   │   ├── navbar.tsx
│   │   └── application/
│   │       ├── progress-bar.tsx
│   │       └── wizard-navigation.tsx
│   └── lib/supabase/client.ts                         # browser client only
├── supabase/                  # DOES NOT EXIST — no migrations in repo
├── docs/                      # DOES NOT EXIST
├── tests/                     # DOES NOT EXIST
└── .github/                   # DOES NOT EXIST — no CI
```

## 5. Existing pages (detail)

### Landing page `src/app/page.tsx`

Static marketing hero with two non-functional `<button>`s ("Start your
application", "Learn more" — no `href`, no handlers). Renders the `Navbar`.

### Navbar `src/components/navbar.tsx`

Static header: links to `/how-it-works`, `/pricing`, `/login`, `/register`.
No session awareness.

### `how-it-works` and `pricing` pages

Placeholder pages containing a single `<h1>` with no content.

### Register `src/app/register/page.tsx`

Client component. Validates fields in the browser, calls
`supabase.auth.signUp` with `options.data.full_name`, logs `data` and `error`
to the console, shows a message. No server-side validation, no redirect, no
email-verification handling beyond a message. Duplicated input styling.

### Login `src/app/login/page.tsx`

Client component. `supabase.auth.signInWithPassword`, console logs
("Login button clicked", "Login successful:"), redirects via
`router.replace("/application/personal-statement")`. "Forgot password?" is a
`window.alert` stub.

### Personal statement wizard `src/app/application/personal-statement/page.tsx`

Client component, 4 steps:

1. Application details (full name, course, university)
2. Motivation and experience
3. Career goals
4. Review

State is persisted to **browser `localStorage`** under key
`offer-ai-personal-statement-draft` via `useEffect`. "Start over" uses
`window.confirm`. On completion navigates to `/application/personal-statement/result`.

### Result page `src/app/application/personal-statement/result/page.tsx`

Client component. Reads answers from localStorage, auto-fires POST
`/api/generate-personal-statement`, saves the generated draft to localStorage
key `offer-ai-generated-personal-statement`, renders an editable textarea,
"Regenerate with AI", "Copy draft", "Clear draft" (with `window.confirm`), and
a "Human expert review" upsell card (£29.99).

### Human review page `src/app/application/personal-statement/human-review/page.tsx`

Client component. Reads localStorage, then inserts a row directly into the
**`review_orders`** table from the browser:

```ts
supabase.from("review_orders").insert({ user_id: user.id, email, applicant_name, ... })
```

"Continue to payment" is a `window.alert` stub ("Stripe payment will be
connected in the next step.").

### AI route `src/app/api/generate-personal-statement/route.ts`

**Currently empty in the working tree (0 lines).** History shows the previous
implementation:

- Reads `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (default `deepseek-v4-flash`),
  `DEEPSEEK_BASE_URL` from env.
- Constructs `new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" })`
  directly in the route handler.
- Posts a hardcoded system prompt + template user prompt, returns the
  generated statement or a raw error message (including provider error text
  exposed verbatim to the client).
- No authentication, no validation library, no rate limiting, no usage
  logging, no retries/timeouts beyond SDK defaults, no versioning of prompts.

## 6. Supabase usage

- `.env.local` contains:

  ```text
  NEXT_PUBLIC_SUPABASE_URL=https://ztbdxvpjacoqsyivhthi.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_2ExnDTC2_OnytyZP1ABqZA_fzw_XFND
  DEEPSEEK_API_KEY=...
  DEEPSEEK_MODEL=deepseek-v4-flash
  DEEPSEEK_BASE_URL=https://api.deepseek.com
  ```

- `src/lib/supabase/client.ts` creates a browser client via
  `@supabase/ssr`'s `createBrowserClient`. It uses the **publishable** key —
  which is correct for browser use — and there is no server client, no
  `createServerClient`, no middleware/proxy, no route protection.
- The `review_orders` table is written to directly from the browser. There is
  **no migration for it anywhere in the repository**, so the production
  schema is not version-controlled.
- `.env.local.save` exists and contains a shell snippet that recreates
  `.env.local`. This is an unusual pattern but not a leak of the secret keys
  beyond what is already in the local environment file.

## 7. Authentication

- Supabase Auth is wired only through the browser client.
- Register and login are client-side with console.log statements.
- No protected routes: every route is public, the wizard pages do not check
  for a session.
- No server-side session helpers, no email verification enforcement, no
  password reset flow, no session-aware navigation.
- The human-review page fetches `supabase.auth.getUser()` in the browser and
  trusts `user.id` for the insert — this is safe from an RLS perspective only
  if RLS exists; there is no evidence of RLS policies in the repo.

## 8. localStorage state (canonical prototype anti-pattern)

Keys in use:

- `offer-ai-personal-statement-draft` — wizard answers + step
- `offer-ai-generated-personal-statement` — generated AI draft

The draft is the **primary** store: page reloads, other devices, and logout
destroy or orphan the data. This must be replaced with Postgres-backed
persistence.

## 9. Documentation

- `README.md` — untouched create-next-app default.
- `AGENTS.md` — only contains the "This is NOT the Next.js you know" notice.
- `CLAUDE.md` — a single line: `@AGENTS.md`.
- No `docs/`, no ADRs, no runbooks, no `.env.example`.

## 10. Missing infrastructure (summary)

| Area | Status |
| --- | --- |
| Monorepo/workspace structure | Missing (single root app) |
| Domain packages | Missing |
| Database migrations | Missing (no `supabase/` dir) |
| RLS policies | Missing from repo |
| Server-side auth helpers | Missing |
| Protected routes | Missing |
| AI provider abstraction | Missing (OpenAI SDK constructed in route) |
| Background worker | Missing |
| Validation library | Missing |
| Error architecture | Missing (raw errors surfaced) |
| Structured logging/observability | Missing (console.log) |
| Tests | Missing (no framework, no tests) |
| CI | Missing (no `.github/`) |
| Env validation | Missing |
| `.env.example` | Missing |
| Feature flags | Missing |
| Seed data | Missing |
| Audit logging | Missing |
| Rate limiting / security headers | Missing |

## 11. What must change (high level)

1. **Structure**: convert to a pnpm monorepo (`apps/web`, `apps/worker`,
   `packages/*`).
2. **Data**: introduce migration-controlled Supabase schema, RLS, seed data.
3. **Persistence**: replace localStorage with Postgres-backed onboarding and
   application-case records.
4. **Auth**: server-side clients, session-aware navigation, protected routes,
   remove console logging.
5. **AI**: `packages/ai` provider abstraction; model name and API keys out of
   application code.
6. **Jobs**: worker app + one demonstration durable job.
7. **Quality**: tests, typecheck, lint, build, CI.
8. **Docs**: README, AGENTS.md, CLAUDE.md, architecture docs, ADRs, runbooks.

## 11b. Development environment discovery

Inspection of the local machine and Docker (2026-08-15):

- A **local Supabase stack is already running in Docker** on this machine
  (network `supabase_network_offerroom`, Kong gateway published on
  `127.0.0.1:54321`):
  - `supabase_db_offerroom` — Postgres 17.6.1, user `supabase_admin`,
    password `postgres` (local dev credentials)
  - `supabase_auth_offerroom` (GoTrue), `supabase_rest_offerroom`
    (PostgREST), `supabase_storage_offerroom`, `supabase_realtime_offerroom`,
    `supabase_studio_offerroom`, `supabase_pg_meta_offerroom`, `supabase_kong_offerroom`
- The default local GoTrue JWT secret is in use
  (`super-secret-jwt-token-with-at-least-32-characters-long`), so the standard
  local Supabase **anon** and **service_role** keys are valid. The anon key
  signature was verified locally, and both keys were confirmed working against
  the local PostgREST gateway (HTTP 200) on `127.0.0.1:54321`.
- Auth is configured with `GOTRUE_MAILER_AUTOCONFIRM=true` and
  `GOTRUE_DISABLE_SIGNUP=false`, so local signups do not require email
  verification (emails go to the local inbucket/mailpit instance).
- The remote project configured in `.env.local`
  (`https://ztbdxvpjacoqsyivhthi.supabase.co`) **does not resolve**
  (`curl: Could not resolve host`). The prototype was pointed at a remote
  project that is not reachable from this environment; the local stack is the
  working development database.
- The local database contains leftover tables from another project
  (`practice_sessions`, `profiles`, `session_participants`,
  `session_marketplace_summaries`). These are unrelated to Offer.ai and will
  be left untouched.
- Host access to the local Postgres container port 5432 is not published; a
  `socat` port-forward container (`offerai-pg-proxy`,
  `127.0.0.1:5432 -> supabase_db_offerroom:5432`) was started so migrations
  and integration tests can connect directly from the host.

Development values used in this foundation (documented in
`docs/runbooks/local-development.md`):

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<standard local anon key>
SUPABASE_SERVICE_ROLE_KEY=<standard local service_role key>
DATABASE_URL=postgresql://supabase_admin:postgres@127.0.0.1:5432/postgres
```

## 12. What is worth keeping (candidate reuse)

- Tailwind v4 + `globals.css` setup and the general slate/blue visual
  language of the prototype components.
- The wizard/progress-bar component concepts (`progress-bar.tsx`,
  `wizard-navigation.tsx`) — reusable as presentation components, subject to
  accessibility and type review.
- The prompt intent for personal statement generation (it will be migrated
  into `packages/ai` with versioned prompts rather than re-authored from
  scratch).
- The register/login form UX patterns (field structure), though they will be
  rewritten with proper validation and no console logging.

The remainder (localStorage flows, direct `review_orders` inserts, placeholder
pricing/how-it-works pages, alert-based interactions, raw DeepSeek
construction in a route) is prototype code to be replaced.

## 13. Foundation Hardening audit (2026-08-16)

A follow-up architecture audit verified the documented claims of the
foundation against the implementation and fixed the gaps found. Findings:

### Verified correct (documented claims match implementation)

- Modular monolith layering: `packages/domain` is framework-free (no
  Next/React/Supabase/AI imports); the web app and worker share domain
  packages.
- Migration discipline: `supabase/migrations/` (0001–0017) is the schema
  source of truth; migrations are replayed cleanly from scratch
  (`pnpm db:reset`).
- RLS is enabled on all student-adjacent tables and exercised by automated
  tests against real Supabase users.
- Background jobs are Postgres-backed, idempotent, and integration-tested.
- AI provider abstraction with a run ledger (`ai_runs`).

### Defects found and fixed

1. **`ucs` → `ucas`**: application-route value corrected everywhere (domain
   constant, migration data fix + CHECK constraint, seed data).
2. **Student identity coupling**: `student_profiles` was keyed on
   `auth.users.id`, making a student exist only after registration. Refactored
   to an independent entity (`student_profiles.id` canonical; nullable
   `user_id` link; `account_status` lifecycle; `created_by_user_id`) with all
   child tables repointed (migration 0011). Prospect creation by
   advisers/guardians (`create_prospect` RPC), claiming (`claim_student_profile`
   RPC + signup email-match claim), creator read-back for unclaimed prospects.
3. **Access-grant semantics**: any active grant previously exposed the whole
   Student 360. Now each resource table checks its own scope
   (`has_scoped_grant`), so a document grant exposes exactly that document and
   a case grant exactly that case (migration 0012 + regression tests).
4. **Atomic application-case operations**: case creation and status
   transitions previously wrote the row and the event in two requests,
   allowing inconsistency. Now single security-definer RPCs create the case +
   event atomically and transition status + event atomically; the state
   machine and institution/course/intake/cycle invariants are enforced inside
   the transaction (migration 0013). Client-side direct writes are blocked by
   RLS; tests prove both the happy path and the invariant rejections.
5. **UK-centric assumptions**: `target_entry_year` window was pinned to the
   current UK cycle; country codes defaulted to `GB`; user preferences
   defaulted to a UK locale/timezone/currency; the GPA check assumed a 5-point
   scale. All removed; qualification systems became a lookup table
   (migration 0014).
6. **Catalogue hardening**: slugs for URLs, polymorphic external identifiers,
   cycle-scoped fees with provenance, requirement verification status, source
   freshness, per-course application routes (migration 0015).
7. **Volatile facts in code**: the UK adapter hard-coded the UCAS equal-
   consideration deadline ("29 January"). Removed; deadlines live in the
   catalogue with provenance (ADR 0004 semantics).
8. **PostgREST `return=representation` quirk**: `WITH CHECK` policies that
   reference security-definer helpers fail for inserts when the client asks
   for the row back (`Prefer: return=representation`). Prospect creation now
   flows through a controlled RPC (migration 0016), avoiding the quirk and
   keeping write authorization in one auditable place.
9. **Restored databases lost schema ACLs**: `db:reset` (and restored dumps)
   dropped the `public` schema ACL, producing "permission denied for schema
   public" for every PostgREST role. Migration 0017 re-applies the standard
   Supabase grants idempotently.
10. **Layer violation**: `packages/database` imported `next/headers`,
    coupling the database package to Next.js and breaking the worker build.
    Replaced with a structural cookie-store contract.
11. **pnpm 11 build-script allowlist**: the workspace file contained an
    invalid `allowBuilds` placeholder that pnpm kept rewriting and that
    blocked native builds (esbuild/sharp/unrs-resolver). Fixed with explicit
    `allowBuilds: true` entries.
12. **Declared dependencies**: `apps/web` and the root used undeclared
    packages (e.g. `@supabase/supabase-js`, `eslint`) that only worked through
    hoisting luck. Declared as direct dependencies.
13. **CI**: the RLS/integration job was effectively disabled (gated on
    secrets that don't exist). CI now starts a fresh Supabase stack
    (`supabase/setup-cli` + `supabase start`), seeds, and runs `pnpm db:test`
    plus Playwright e2e — the same gates as locally.

### Regression coverage added

- `supabase/tests/rls.test.ts` rewritten for the new semantics (identity
  separation, claiming, scoped grants, RPC-only atomic case operations,
  invariant rejections, internal-table isolation).
- `supabase/tests/jobs.test.ts` (enqueue → claim → complete → idempotency).
- e2e updated to a deterministic seed course/cycle combination.
- All gates (`typecheck`, `lint`, `test`, `db:test`, `build`, `test:e2e`)
  run green locally and in CI.
