# Ingestion Architecture

## Purpose

`packages/ingestion` owns the pipeline that keeps the admissions catalogue
(`catalog_*` tables) accurate and **provenanced**. Crawlers never write to
production course requirements directly.

**Foundation status:** interfaces and types only. No crawler, no scheduler,
no web fetcher is implemented yet.

## Pipeline

```text
source registry → schedule → fetch → raw snapshot
→ extract → normalize → validate → diff
→ review if necessary → publish
```

Stages:

1. **Source registry** — `catalog_sources`: which institution pages exist,
   their URL, owner, extractor version, fetch cadence.
2. **Schedule** — worker jobs (`catalog.fetch`, …) per source policy
   (respect robots.txt, rate limits).
3. **Fetch** — retrieve raw content; store **immutable** raw snapshot in
   `catalog_source_snapshots` with content hash. Fetching is idempotent:
   unchanged content (same hash) is not re-extracted.
4. **Extract** — parse the raw snapshot into structured candidate facts
   (extractor version recorded). LLM extraction is allowed here but output
   is schema-validated and marked `machine_extracted`, never `human_verified`.
5. **Normalize** — map extractor output to canonical catalogue records
   (institution, course, requirement) and country conventions.
6. **Validate** — structural checks against target schema.
7. **Diff** — compare candidate records against the effective current record.
   Changed requirements create **new effective-dated records**; history is
   never overwritten.
8. **Review if necessary** — high-confidence, low-impact changes publish
   automatically; anything ambiguous routes to a review queue.
9. **Publish** — write new effective-dated records with
   `observed_at`, `published_at`, `superseded_by` and source linkage.

## Principles

- **Idempotent**: every stage can be re-run safely (content hashes,
  `superseded_by` chains, unique constraints).
- **Provenance first**: every published fact points back to a source, a
  snapshot, an extractor version and a confidence.
- **Separation**: fetch ≠ extract ≠ normalize ≠ publish, so each stage can
  be replaced independently.
- **No silent mutation**: publication of a requirement change is an event,
  not a silent UPDATE.
- **Rate and politeness**: source registry drives scheduling; robots.txt is
  honoured.

## Interfaces (foundation)

```typescript
interface SourceRegistry { ... }        // list sources, policies
interface ContentFetcher { fetch(...) } // returns raw snapshot + hash
interface Extractor { extract(...) }    // raw snapshot → validated facts
interface Normalizer { normalize(...) } // facts → canonical records
interface CataloguePublisher { publish(...) } // diff + effective-dated write
```

Concrete implementations arrive with the catalogue ingestion worker
(see `docs/product/domain-map.md` — future work).

## Effective dating interaction

Publication uses the `catalog_course_requirements` effective-dating fields:

```text
effective_from / effective_to / observed_at / published_at / superseded_by
```

A published requirement chain is immutable; corrections appear as new
versions effective from a later date.
