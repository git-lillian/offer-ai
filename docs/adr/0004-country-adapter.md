# ADR 0004 — Country Adapter Architecture

- Status: accepted
- Date: 2026-08-15

## Context

Offer.ai starts with UK admissions but must later support the US, Canada,
Australia, Europe and other destinations. Entry-requirement logic is
inherently country-specific (qualifications, grading, application routes,
deadlines, documents). Scattered country checks through the codebase would
make new countries expensive to add and risky to maintain.

## Decision

Introduce the `AdmissionsCountryAdapter` interface in
`packages/admissions-engine` and implement the **UK adapter as country
implementation number one**.

```typescript
interface AdmissionsCountryAdapter {
  countryCode: string; // ISO 3166-1 alpha-2 destination code
  getApplicationCyclePolicy(...): Promise<...>;
  validateApplicationPortfolio(...): Promise<...>;
  determineRequiredDocuments(...): Promise<...>;
  mapExternalApplicationStatus(...): Promise<...>;
  evaluateCountrySpecificRules(...): Promise<...>;
}
```

- Adapters are discovered through a factory (`countryAdapter(countryCode)`),
  never via `switch` statements spread across call sites.
- Each country lives in `packages/admissions-engine/src/countries/<code>/`
  with its own versioned rules directory.
- The deterministic eligibility engine composes adapters; the LLM only
  explains results.
- UK adapter v1 implements minimal policy/status scaffolding; comprehensive
  rules are future work behind the same interface.

## Consequences

- Adding a country = adding a directory + factory entry; no UK code changes.
- Country-specific quirks are testable in isolation with dedicated fixtures.
- The internal application model stays decoupled from any external system
  (e.g. UCAS): `ApplicationCase → ApplicationSystemAdapter → UCAS` boundary
  means undocumented third-party APIs are never called directly.

## Alternatives considered

- One global rules engine with country switches: rejected — violates the
  open/closed principle, countries would interfere with each other.
- Country as a data attribute only (no code boundary): rejected — countries
  differ behaviourally, not just by data.
- Build US/Canada/Australia adapters now: rejected — YAGNI; UK validates
  the pattern first.
