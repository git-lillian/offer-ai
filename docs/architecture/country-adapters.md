# Country Adapters

## Purpose

Admissions rules differ by country. The platform must not scatter
country-specific `if` statements through application code.

**Foundation status:** the adapter interface and the UK adapter skeleton
exist in `packages/admissions-engine`. Only minimal, useful UK rules are
implemented; US/Canada/Australia are explicitly future work, and adding them
must not require touching the UK implementation.

## Interface

```typescript
interface AdmissionsCountryAdapter {
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "GB"

  getApplicationCyclePolicy(...): Promise<...>;
  validateApplicationPortfolio(...): Promise<...>;
  determineRequiredDocuments(...): Promise<...>;
  mapExternalApplicationStatus(...): Promise<...>;
  evaluateCountrySpecificRules(...): Promise<...>;
}
```

- `countryCode` identifies the admissions **destination** country (where the
  course is), not the applicant's nationality.
- Future countries add a new adapter in
  `packages/admissions-engine/src/countries/<code>/` plus a factory entry;
  nothing in the UK adapter changes.

## Structure

```text
packages/admissions-engine/src/
├── countries/
│   └── uk/
│       ├── uk-adapter.ts
│       └── rules/            # versioned rule modules
├── engine/                   # deterministic eligibility pipeline
└── types.ts                  # CourseRecommendation, reasons, blockers
```

## UK adapter (v1 — minimal)

The UK adapter v1 implements:

- **Application cycle policy**: entry year validation against configured
  `ApplicationCycle` (e.g. 2026/27). No admission portfolio validation yet.
- **Required documents baseline**: returns a placeholder document list
  (to be expanded by the documents vertical slice).
- **External status mapping**: placeholder mapping of the internal
  `ApplicationCase` status to UCAS-like statuses (contract only; no UCAS
  integration — undocumented third-party APIs are never called).

## Eligibility pipeline

The engine is **deterministic and rule-based**; the LLM never decides
eligibility. The pipeline shape:

```text
student profile → hard eligibility → academic competitiveness
→ subject fit → career fit → preference fit → affordability
→ portfolio strategy → recommendation
```

Result type (contract in `packages/admissions-engine`):

```typescript
type CourseRecommendation = {
  courseId: string;
  eligibility: "eligible" | "ineligible" | "uncertain";
  strategyBand: "aspirational" | "target" | "safer";
  score: number;
  confidence: number;
  reasons: RecommendationReason[];
  blockers: RecommendationBlocker[];
  missingInformation: MissingInformation[];
};
```

Every result is reproducible from (student profile version, catalogue
version, rule version) — recorded on the result.

## Rules architecture

- Rules are **versioned modules** (`rules/<name>/<version>.ts`), not
  scattered `if` statements.
- Rule evaluation runs against a ruleset version; the engine stores which
  ruleset produced a result.
- Foundation ships only the rule interfaces + one or two demonstrable UK
  rules (e.g. level matching); comprehensive rules for Chinese degrees, IB,
  A Levels, AP, GPA systems, etc. are future work.
