# ADR 0003 — Background Jobs on Postgres

- Status: accepted
- Date: 2026-08-15

## Context

Offer.ai must run long work outside HTTP requests: AI generation, document
processing, catalogue ingestion, notifications. The prototype had no job
infrastructure at all.

Options considered: a dedicated queue broker (Redis + BullMQ, SQS, Kafka),
or Postgres itself as the queue.

## Decision

**Use a Postgres-backed job queue** (`public.background_jobs` table) with a
polling worker in `apps/worker` that claims jobs with
`SELECT … FOR UPDATE SKIP LOCKED`.

Properties:

- Job fields: `kind`, `payload` (jsonb, zod-validated at enqueue),
  `idempotency_key` (unique), `correlation_id`, `status`, `attempts`,
  `max_attempts`, `last_error`, `available_at`, timestamps.
- Claiming uses `FOR UPDATE SKIP LOCKED` with a bounded batch: safe under
  concurrent workers without a broker.
- Idempotent enqueue via `idempotency_key`; handlers are written
  idempotently (terminal `completed` state, side effects keyed by
  correlation id).
- Exponential backoff on failure via `available_at`; `max_attempts` bounds
  retries.

## Consequences

- Zero new infrastructure: the existing Postgres stores both data and jobs,
  so a transaction can enqueue work atomically with the data change that
  triggered it.
- Simplest durable choice that satisfies correctness requirements
  (durability, idempotency, retry); the worker is a plain Node process
  sharing the domain packages.
- Scaling limit: single-table queue throughput. If Offer.ai grows past a
  few thousand jobs/second, migrate to a dedicated broker — the job model
  and worker contract are broker-agnostic, so the move is contained.

## Alternatives considered

- Redis + BullMQ: rejected at this stage — extra service to operate, no
  current need for sub-second latency or advanced scheduling.
- Kafka: rejected — event-streaming semantics are overkill; no cross-team
  event bus exists yet.
- SQS: rejected — cloud-lock-in and separate deployment story not justified
  yet.
- Long-running work inside HTTP requests: rejected outright (ADR 0001
  philosophy); requests enqueue, the worker executes.
