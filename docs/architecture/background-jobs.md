# Background Jobs Architecture

## Decisions

- Durable jobs stored in **Postgres** (`background_jobs` table) — no Redis,
  no Kafka at this stage (ADR 0003).
- The worker (`apps/worker`) is a separate Node process using the **same
  domain packages** as the web app.
- Heavy work (AI generation, crawling, document processing) **never runs
  inside an HTTP request**. Request handlers enqueue; the worker executes.

## Queue model

`background_jobs`:

```text
id                uuid pk
kind              text        # e.g. 'ai.generate_text'
payload           jsonb       # zod-validated at enqueue time
status            text        # queued | running | completed | failed | cancelled
idempotency_key   text unique # dedupe re-enqueues
correlation_id    uuid
attempts          int         # number of execution attempts
max_attempts      int
last_error        text
available_at      timestamptz # earliest execution time (backoff)
created_at        timestamptz
started_at        timestamptz
completed_at      timestamptz
```

Claiming a job: the worker uses `SELECT … FOR UPDATE SKIP LOCKED` with a
bounded batch, so multiple worker instances can poll safely without double
execution.

## Idempotency

- Enqueueing uses `idempotency_key`: re-enqueuing the same logical operation
  updates the existing row instead of creating a duplicate.
- Handlers are written to be idempotent: `completed` status is terminal, and
  a handler re-running after a crash must not produce duplicate side effects
  (e.g. duplicate ledger entries keyed by correlation_id).

## Worker loop

```text
poll (batch, FOR UPDATE SKIP LOCKED)
  → mark running (started_at, attempts+1)
  → dispatch to registered handler (kind → handler map)
  → handler returns success → mark completed (completed_at)
  → handler throws → if attempts < max_attempts: failed → re-queue with
    exponential backoff (available_at = now + backoff(attempts))
    else: mark failed with last_error
  → log job lifecycle: started / completed / failed / retrying + duration
```

## Job registry

Handlers register by kind. Foundation includes one demonstration job:

- `demo.echo` — harmless job that logs its payload and completes
  idempotently. It exists to prove the enqueue → consume → complete loop.

Future kinds (documented, not implemented):

- `document.process` — upload OCR/extraction
- `catalog.fetch`, `catalog.extract`, `catalog.diff` — ingestion pipeline
- `ai.generate`, `ai.verify` — document generation / verification
- `notification.send` — notifications
- `billing.webhook` — payment events

## Enqueueing from the web app

`packages/database` exposes `enqueueJob(db, input)` used by route handlers /
server actions. Validation happens at the boundary with zod.

## Observability

- Every job carries a `correlation_id` propagated to the domain logger.
- Structured lifecycle logs with duration (see `packages/config` logger).
- Failed jobs retain `last_error` (redacted) for investigation.

## Running locally

```bash
pnpm --filter worker dev     # tsx watch src/index.ts
```

See `docs/runbooks/local-development.md`.
