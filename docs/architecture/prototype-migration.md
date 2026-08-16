# Prototype Migration Plan

This document records how the prototype (commits up to `7876860`) is being
migrated into the production architecture. It exists so the transition is
reversible and explainable.

## Principle

Preserve Git history. All work happens in the same repository. Code is
moved, refactored, or deleted with intent; nothing is silently dropped
without a note here.

## What is being removed / replaced

| Prototype artefact | Action | Reason |
| --- | --- | --- |
| `src/app/application/personal-statement/*` (wizard, result, human-review) | Removed from primary navigation; flow archived under `git history` | localStorage-canonical wizard contradicts the canonical-Postgres rule; human-review flow wrote directly to `review_orders` from the browser |
| `src/app/api/generate-personal-statement/route.ts` | Deleted | Direct `new OpenAI()` construction in a route handler; replaced by `packages/ai` provider abstraction |
| `src/lib/supabase/client.ts` (browser-only) | Refactored | Becomes one of three clients (browser/server/service-role) with session handling |
| `src/app/login/page.tsx`, `register/page.tsx` | Rewritten | Client-side only, console logging, no server validation, no protected routing |
| `src/app/how-it-works/page.tsx`, `pricing/page.tsx` | Removed | Placeholder pages with no content |
| `src/app/page.tsx` landing | Rewritten | Dead buttons, no session-aware navigation |
| `src/components/navbar.tsx` | Rewritten | Static, no session awareness |
| `localStorage` keys `offer-ai-personal-statement-draft`, `offer-ai-generated-personal-statement` | Deprecated | Canonical data moves to Postgres |
| `review_orders` direct inserts | Removed | No migration existed in the repo; table was not version-controlled |

## What is retained

| Prototype artefact | How retained |
| --- | --- |
| Wizard UI concepts (`progress-bar.tsx`, `wizard-navigation.tsx`) | Rebuilt as `packages/ui` components (accessible, typed) and reused by the onboarding flow |
| Personal statement prompt intent | Migrated into `packages/ai/prompts/personal-statement/v1` (versioned asset) |
| Visual language (slate/blue, rounded cards) | Kept in `packages/ui` and web globals |
| Supabase Auth as the auth provider | Kept; hardened (server validation, no console logs, protected routes) |
| DeepSeek as the first AI provider | Kept; behind `packages/ai` `DeepSeekProvider` |

## Personal statement feature (future)

The personal statement flow will return as the **Document Studio** built on
the artifact model (`artifacts`, `artifact_versions`): versioned, evidence-
linked, AI-origin-tracked, submission-safe. It is not rebuilt during this
foundation phase — the artifact tables and types are the migration target.

## Database

- The prototype had **no migrations** in the repository (the `review_orders`
  table was created manually outside version control).
- The foundation introduces `supabase/migrations/` as the single source of
  schema truth (see `docs/architecture/database.md`).

## Rollback

- Git history preserves every prototype commit; reverting to
  `7876860` restores the full prototype.
- Migrations are additive and forward-only; a fresh environment replays
  them from scratch (`pnpm db:migrate`).
