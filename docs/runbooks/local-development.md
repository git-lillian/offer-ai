# Local Development Runbook

## Prerequisites

- Node.js ≥ 20 (tested on 24)
- pnpm ≥ 9 (workspace manager)
- Docker (local Supabase stack)

## 1. Local Supabase

This repository is developed against a local Supabase stack running in Docker
(network `supabase_network_offerroom`, gateway on `127.0.0.1:54321`).

Verify it is up:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep supabase
```

Key services:

| Service | Port (host) | Notes |
| --- | --- | --- |
| Kong gateway (API) | `127.0.0.1:54321` | `/auth`, `/rest`, `/storage` |
| Postgres | `127.0.0.1:5432` (via socat proxy) | user `supabase_admin`, password `postgres` |
| Studio | container-internal | use `docker port` to inspect |

If the port-forward to Postgres is missing:

```bash
docker run -d --name offerai-pg-proxy \
  --network supabase_network_offerroom \
  -p 127.0.0.1:5432:5432 \
  alpine/socat TCP-LISTEN:5432,fork,reuseaddr TCP:supabase_db_offerroom:5432
```

## 2. Environment configuration

```bash
cp .env.example .env.local
```

`.env.example` documents every variable. For local development against the
stack above the values are:

```bash
# public (bundled to the browser)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>

# server/worker only
SUPABASE_SERVICE_ROLE_KEY=<local service_role key>
DATABASE_URL=postgresql://supabase_admin:postgres@127.0.0.1:5432/postgres

# AI (server/worker)
AI_PROVIDER=deepseek            # or fake
AI_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=<your key>
```

The local Supabase project uses the standard demo JWT secret; the matching
anon/service-role keys are the well-known local keys. Regenerate a
service-role JWT if the local stack's secret changes:

```bash
node scripts/issue-service-role-jwt.mjs   # prints a fresh JWT
```

## 3. Install

```bash
pnpm install
```

## 4. Database

```bash
pnpm db:migrate      # apply supabase/migrations in order
pnpm db:seed         # load supabase/seed.sql (development data)
pnpm db:test         # run RLS policy tests against local Supabase
pnpm db:reset        # drop + re-run migrations + seed (dev only)
```

Migrations are SQL files in `supabase/migrations/`, applied transactionally
and recorded in `public.schema_migrations`. Never edit an applied migration —
add a new one.

## 5. Run the apps

```bash
pnpm dev             # web app on http://localhost:3000 (Next.js)
pnpm worker:dev      # background worker (tsx watch)
```

## 6. Quality gates

```bash
pnpm typecheck       # tsc --noEmit across all packages
pnpm lint            # eslint across the workspace
pnpm test            # unit + integration tests
pnpm build           # production build (web + worker)
```

### End-to-end tests

```bash
pnpm test:e2e        # Playwright critical flows (register → onboarding → case)
```

E2E tests need a production build of the web app (`pnpm build`) and a running
Supabase stack. Playwright browsers must be installed once:

```bash
npx playwright install chromium
```

## 7. Local AI without an API key

Set `AI_PROVIDER=fake` in `.env.local`. `packages/ai` falls back to a
deterministic stub so the vertical slice works offline.

## 8. Email verification locally

Local auth runs with `GOTRUE_MAILER_AUTOCONFIRM=true`, so signup does not
require email confirmation. Mailpit/inbucket runs inside the stack if you
need to inspect auth emails.

## Troubleshooting

- **CORS/401 from the browser**: confirm `NEXT_PUBLIC_SUPABASE_URL` points at
  `http://127.0.0.1:54321` and the anon key matches the local stack.
- **`schema_migrations` not found**: run `pnpm db:migrate` first.
- **Port 5432 already in use**: stop the socat proxy
  (`docker rm -f offerai-pg-proxy`) and recreate with a different host port,
  updating `DATABASE_URL` accordingly.
- **Worker sees no jobs**: jobs are enqueued with `available_at` in the
  future during backoff; check `status` and `available_at` in
  `public.background_jobs`.
