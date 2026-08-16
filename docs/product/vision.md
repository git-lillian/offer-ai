# Offer.ai — Product Vision

## Mission

Offer.ai is a digital university admissions platform. It helps students —
initially international and domestic students applying to UK universities —
understand where they can get in, build the strongest possible application,
and manage every step until the offer arrives. In later phases it will take
on most of the functions of a traditional education agent while allowing
students to use the platform independently.

## Scope over time

Initial market:

- UK undergraduate and postgraduate admissions
- International and domestic students
- Guided application workflow: onboarding, eligibility, documents, statements

Future markets (architecture must not block these):

- United States, Canada, Australia, Europe, other international destinations

## Product capabilities (target vision)

1. Student onboarding and Student 360 profile
2. Academic history and qualification capture
3. Uploaded-document extraction
4. University and course database
5. Course entry requirements
6. University/course recommendations
7. Admissions strategy
8. Eligibility assessment
9. Application case management
10. Application tracking
11. Personal statements
12. CV creation
13. Supplementary application answers
14. AI admissions adviser
15. Human adviser/reviewer marketplace
16. Adviser/student messaging
17. Marketplace payments and commissions
18. Student experience gap analysis
19. Internship opportunities
20. Volunteering opportunities
21. Courses, competitions and development opportunities
22. University/application news
23. Deadline monitoring
24. Scholarships
25. Notifications
26. Guardian/parent access
27. External admissions-system integrations (e.g. UCAS)
28. B2B agency functionality (later phases)

## What this foundation phase builds

The foundation does **not** implement all of the above. It establishes:

- A modular monolith repository structure that can grow into those
  capabilities without a rewrite.
- A migration-controlled database with Row Level Security protecting student
  data.
- A domain layer with explicit bounded contexts.
- Working authentication and the first vertical slice:
  register → login → onboarding → dashboard → create application case → resume.
- An AI provider abstraction and a background worker skeleton.
- Documentation that reflects the code.

Everything not built is explicitly marked as future work in the architecture
documents. See `docs/product/domain-map.md` and `docs/architecture/*`.

## Product principles

- **The student owns their data.** AI output never silently becomes canonical
  student fact; evidence and student confirmation gate every fact.
- **Admissions truth is structured and versioned**, not scraped text. An LLM
  response is never a trusted university requirement.
- **The platform works without an agent.** The student is the primary user;
  advisers and agencies are additive.
- **Decisions are reproducible.** Recommendations and eligibility results can
  be traced to profile version, catalogue version and rule version.
- **One domain, many countries.** Country-specific behaviour is isolated
  behind adapters, with the UK as the first implementation.
