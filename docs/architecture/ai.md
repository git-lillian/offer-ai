# AI Architecture

## Purpose

`packages/ai` is the only place that talks to AI providers. Application code
never constructs `new OpenAI(...)` and never hard-codes model names. This
keeps providers interchangeable (DeepSeek today, OpenAI/future providers
later), models centrally routed, and costs/errors observable.

## Provider abstraction

```typescript
interface AIProvider {
  generateStructured<T>(params: StructuredGenerationParams<T>): Promise<StructuredResult<T>>;
  generateText(params: TextGenerationParams): Promise<TextResult>;
}
```

- `StructuredGenerationParams` carries `schema` (zod) so structured output is
  validated at the boundary — AI output is never trusted.
- `TextGenerationParams` carries system prompt + user content + options
  (temperature, max tokens).
- Results include `usage` (input/output tokens) and `model`, enabling the
  run ledger.

Adapters:

- `DeepSeekProvider` — OpenAI-compatible client, base URL from env, model
  from `packages/config` (`AI_MODEL`), no model names in application code.
- `FakeProvider` — deterministic stub for tests and local development without
  an API key.

Provider selection is a factory: `createAIProvider(env, logger)`.

## Model routing

`packages/config` exposes:

```text
AI_MODEL                # primary model
AI_PROVIDER             # deepseek | fake
```

Routing rules are centralised; adding a provider means adding an adapter and
a config branch, not touching call sites.

## Reliability

- Timeouts: provider calls wrap in a configurable timeout.
- Retries: transient failures retry with exponential backoff (bounded);
  errors surface as typed `ExternalServiceError` / `RateLimitError`.
- Fallbacks: when the primary provider fails, a configured fallback provider
  may be used (enabled via config).

## Prompt management

- Prompts are versioned assets: `packages/ai/prompts/<name>/<version>.ts`
  exporting `{ id, version, system, buildUserContent }`.
- A run always records its `prompt_version`, so behaviour is reproducible
  and A/B-able.
- Prompt content is the only place where instructions to the model live;
  business rules never hide inside prompts.

## AI run ledger

Every execution is recorded in `ai_runs` (service-role only):

```text
operation, provider, model, prompt_version, input_hash,
student_id, application_case_id, artifact_id,
latency_ms, token_usage (input/output), estimated_cost,
status, error_class, correlation_id, created_at
```

- `input_hash` allows duplicate detection without retaining raw sensitive
  prompts indefinitely.
- Observability data is separated from retained user content.
- Cost estimation: per-provider token pricing tables in `packages/ai`.

## Hallucination prevention (design, not yet implemented)

Document generation will follow a pipeline (interfaces exist in
`packages/ai` and `packages/domain`):

```text
select verified evidence → content plan → generate
→ factual consistency check → unsupported claim detection
→ style check → save draft → student review
```

- AI-generated facts never silently become verified student facts. They
  enter the evidence pipeline as `machine_extracted` and require student
  confirmation (see `docs/product/domain-map.md`).
- Context building is explicit: `buildStudentContext()`, `buildCourseContext()`
  etc. select only the fields an operation needs, each carrying an evidence
  reference. Full database records are never handed to a model.

## Integration points

- `apps/worker` runs generation as background jobs (`ai.generate.*`).
- Short synchronous operations (e.g. explaining a recommendation) may call
  the provider from `apps/web` through `packages/ai`, still recording the
  run in `ai_runs`.
- The eligibility engine (`packages/admissions-engine`) is deterministic;
  the LLM can *explain* a result, never *decide* it.
