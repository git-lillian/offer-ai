# Marketplace Architecture

## Purpose

Offer.ai will eventually run a marketplace where students buy services from
human advisers/reviewers (personal statement review, application strategy,
mentoring) and Offer.ai takes a platform fee.

**Foundation status:** domain types and interfaces only. No marketplace UI,
no payments, no Stripe integration.

## Relationship to billing

Two independent money concepts, never merged into a single `payments`
boolean:

1. **Platform subscriptions** — student subscriptions to premium Offer.ai
   features (billing domain, `packages/billing`).
2. **Marketplace transactions** — payments to human advisers/reviewers with
   an Offer.ai platform fee (marketplace domain, `packages/domain`).

## Marketplace entities (types in `packages/domain/src/marketplace/`)

```text
ProviderProfile     # provider identity, verification status, specialisms
ProviderVerification # identity/KYC state
Specialism          # e.g. 'personal statement', 'strategy'
CountryScope        # countries served
SubjectScope        # subjects served
LanguageScope       # languages spoken
ServiceListing      # what is sold: price, currency, turnaround, scope
Availability        # booking slots
Booking             # student ↔ provider booking
ServiceOrder        # an order for a service deliverable
ServiceDeliverable  # the delivered outcome (e.g. reviewed statement)
Review              # order review/rating
Dispute             # dispute resolution
Commission          # Offer.ai fee on a transaction
PayoutAccount       # provider payout destination
```

## Access control boundary

- A marketplace **provider does not automatically get student access**.
- Student data access is always through an explicit `access_grant`
  (scope: profile, specific cases, specific documents, specific services;
  expiry and revocation supported — see `docs/architecture/security.md`).
- Service fulfilment uses grants scoped to the order's documents/cases.

## Payments

- Marketplace payments remain separate from SaaS subscription billing.
- Stripe integration comes **after** the billing domain types are stable
  (`packages/billing`) — never before.

## Future work

- Full marketplace UI, search, availability, booking, reviews
- Stripe Connect payouts, commissions, disputes
- Provider verification workflow
