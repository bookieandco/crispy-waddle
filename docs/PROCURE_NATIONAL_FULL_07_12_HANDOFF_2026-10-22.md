# PROCURE.NATIONAL.FULL.07–.12 — nationwide procurement and regional prime/fulfillment acceptance

**2026-10-22 · existing Jhadina Opportunity Core · repository `bookieandco/crispy-waddle` · draft PR #1478.**

## Executive result

Implemented nationwide research layers on the existing architecture—not a duplicate procurement engine—and prepared a reusable **buyer → official source → solicitation → regional prime/supplier → 21-gate compliance → canonical no-send bid review** flow. Main and production remain untouched. **The implementation does not mean every U.S. jurisdiction publishes a verified, active solicitation feed.** It cannot itself manufacture prime eligibility, written quotes, legal teaming agreements or bidder authorization.

## Verified inventory, read-only connected Supabase evidence
- 80,742 inventoried state/local/public institutions in the existing 50-states-plus-DC jurisdiction table; this list includes 41,633 special districts, 19,468 municipalities, 13,350 school districts, 3,144 counties, 1,952 universities, 1,144 public hospitals and 51 states/DC.
- Prior installed security-invoker rollup: 26,586 procurement source rows, 3,755 buyer jurisdictions with any source, 3,686 with verified official sources, **60 with access-reviewed certified active read-only sources**. These are four different statuses.
- 77,328 blocked discovery jobs; 69,738 missing official domains/search-provider configuration. Exactly 77 previously blocked jobs (across 33 states) had newly matched official domains under the bounded requeue condition; no nationwide mass reset was performed.
- Existing local award/prime system: **12** `jhadina_public_prime_profiles` with attributed historical evidence, concentrated in the city of Chandler, Arizona; **46** package provider candidates still `review_required`. Historical awarded contractors, including federal award recipients, are **not certified local vendors**.
- RUSD 2026/27-11 remains a planholder-document-dependent school RFQ; adapter previously marked degraded, access review pending. No active RUSD parser certification, approved live bid package, supplier quote or proposal submission.

## Full sequence

### .07 — CI recovery and private review
- Reconciled parent PR #1478, branch, 51-state core, procurement UI and national read-only Supabase security-invoker view without altering production.
- Added new deterministic tests to the existing Opportunity Core suite and Local Gov targeted workflow for regional prime, missing catalogs, procurement portal classification, full risk checklist and first pilot. Full private Web Next.js type/build & acceptance depend on **exact head** GitHub workflows. Superseded runs may show canceled; do not interpret as failed test assertions.
- Vercel deployment creation previously returned HTTP **402: api-deployments-free-per-day**. No paid upgrade made. New private preview not certified at this head. Existing earlier preview does not certify new national UI and cannot be described as current.
- Owner sign-in, Face ID and click-through tests require authenticated owner iPhone access; protected unauthenticated route redirect was checked in previous phase, but authenticated UX remains **unverified**.

### .08 — Reuse nationwide source and real jurisdiction IDs
- Kept security-invoker coverage view, owner-only `GET /api/opportunities/procurement/coverage`, paginated buyer directory, and exact-ID OIDC no-bulk-source-discovery recovery.
- `/opportunity/procurement` selects one of 50 states/DC, finds city/county/school/special-district/university/hospital buyer records, links recorded source samples and routes a recorded open solicitation into the canonical no-send packet.
- Source status remains explicit: inventoried government, observed URL, verified official publisher, certified read-only adapter, solicitation document package, bidder-eligible partner—all separate checkpoints.

### .09 — Missing American government families
- Staged **separate** official catalog references and canonical-ID gates in `national-procurement-expansion.ts`:
  - Five inhabited U.S. territories (PR, GU, VI, AS, MP), not incorrectly folded into the Census 50-state table.
  - 575 federally recognized tribal entities listed by the Bureau of Indian Affairs as of January 30, 2026; recognition is **not** evidence they operate a public bidding portal. Tribal contracting/sovereign law requires separately corroborated procurement eligibility.
  - 2025 Census Government Units Listing (including differing township and independent/dependent classifications), not a one-to-one match to Jhadina's mixed entity roster.
  - Federal agencies remain integrated through existing SAM.gov solicitation and award pathways rather than duplicated per county.
- `assessExpansionIdentity` separately validates government-unit identity and buyer-linked solicitation source; a federally recognized Tribal government can be officially identified even if its procurement portal remains unknown. Bad identifiers/provenance and invalid territory codes fail identity validation, and no source enters the active-bid category without separate certification. Actual catalog intake/deduplication remains a validated workflow; no 575 tribal buyers or territory bid feeds are falsely marked live.

### .10 — Reusable procurement-portal classification
- Added allowlist-backed **platform family classifications** for OpenGov, PlanetBids, IonWave, Bonfire, BidNet, PublicPurchase, DemandStar and bidsandtenders, as well as official .gov and unknown URLs. Hostname suffixes are exact to prevent lookalike domain acceptance.
- Verified-source directory displays portal family while `classifyProcurementPortal` keeps robots/access terms, login requirements, buyer-to-portal official link evidence, stable bid IDs and closed/canceled/expired detection as mandatory independent checks.
- Even a complete portal-classification candidate remains `not_certified` and `externalFetchAuthorized=false`. No attempt to bypass planholder credentials, captchas or robots restrictions.
- The existing bounded exact-ID shadow adapter remains canonical for live parser trials and certification; no nationwide crawler, scraper or scheduler was unleashed.

### .11 — Regional prime contractors & fulfillment roles
- Existing `public-award-prime`, `prime-subcontractor-matching`, `public-prime-coverage`, `provider-matching` and SAM/provider cores are reused.
- Added `national-regional-prime.ts` (six structures: direct prime, regional prime teaming, awarded-prime subcontract, specialty sub, authorized reseller and cooperative contract).
- Matches use award/NAICS/capability and state/county evidence **as discovery signals**, not service area or capacity certifications. Blocks unknown licensing, bonding, insurance, registration, direct/sub bid legality, incomplete official docs/addenda, supplier capacity, prime consent, firm quote, deadlines and human signing authority. Any declined/unavailable/expired/no-evidence candidate is blocked. High score does not authorize outreach or a bid.
- Owner-only `GET/POST /api/opportunities/procurement/primes` reads existing 12 historical prime profiles by state and evaluates a canonical server-held pilot or persisted inbox observation. UI shows evidence-backed results or an honest empty state, with **Match regional prime contractors** next to no-send bid packet preparation.
- Added an optional **manual owner-clicked** `public-usaspending-regional-primes.ts` Treasury federal-award research adapter with a 12-month state/PoP search, capped at 12 observed prime awards; never scheduled, persisted, contacted or represented as current local bidder qualification. Uses official USAspending public v2 search endpoint and mocks/tests. SBA SUBNet and prime-subcontracting resource remains a supplementary official reference, not a confirmed local bid feed.

### .12 — 21 independent compliance and commercial gates
- `national-procurement-route-review.ts` enumerates 21 source-attributed gates: official notice, amendments, buyer identity, legal bidder role, prime/sub rules, registration/prequalification, set-asides, licenses, bonds, insurance, wages, site visit/Q&A, scope quantities, capacity, consent, written firm quote, taxes/freight/delivery, overhead/warranty/contingency, cashflow/retainage/payment terms, forms, deadline, and human approval.
- These are **not configurable shortcuts** to submitting; even with all evidence the result is still `human_approval_required` and no-send. Existing canonical `reviewProcurementCommercial`/`prepareProcurementBidPacket` perform the underlying commercial/packet checks. Explicit legal review is needed for contractor-of-record, licensing and school public works rules.
- Regression proves the **RUSD truck RFQ → historic regional prime → portal risk → 21-gate review** remains blocked with missing official scope and vendor quote. It is not a demonstration of an actual successful bid or verified profit.

## Additional pursuit angles to research on real opportunities
1. Official solicitations (SAM.gov, states, counties, cities, schools, universities, public hospitals, transit/water/power special districts).
2. Pre-solicitation/board agenda/budget/capital projects, scheduled construction starts and renewals: market intelligence, not a posted open bid.
3. Award history and incumbents (local public award registers, Treasury USAspending, SAM awards), plus expiration windows; past work alone doesn't demonstrate a subcontracting opening.
4. Regional prime teaming, direct registration, specialty subcontractor, manufacturer authorized resale, cooperative/master agreement, and bona fide prime-sub subcontracting.
5. SBA SUBNet, prime subcontracting plans and recipient contracting portals as **lead sources** subject to source-specific eligibility and bid deadlines.
6. Legislative/public finance and bonding/appropriation before treating an approved capital project as a funded award.
7. Construction, prevailing wage, required trade licenses, union/PLA, set-asides, public agency vendor registrations, insurance, bond and bonding capacity, pre-bid conference/mandatory walk, sub approval and certified payroll.
8. Commercial feasibility: exact scope/quantity, written supplier price, taxes, freight, permits, markup, overhead, warranties, contingency, payment terms, financing burden, retainage, and collection risk. Never manufacture an estimated margin without all-in cost evidence.

## Next exact acceptance gates and restrictions
- **Check current-head GitHub CI** and resolve failures, then owner iPhone login and private preview acceptance when the Vercel quota permits free preview. Do not promote current code to production automatically.
- Official access/robots clearance for selected sources; three read-only trial observations and structural-ID/closed-bid/addenda checks before adapter certification.
- Verify raw BIA/Census records and add territorial tribal catalog provenance *without* promoting them into 50-state local units or inventing procurement portals.
- Expand award sources beyond 12 local historical prime profiles, preserving source refs and separate historical/available/consenting roles.
- Request actual RUSD planholder documents through legitimate account, then verify scopes and eligibility. No supplier contact, bid, signature, payment, or live posting without separate approval.
- Main untouched; PR remains draft until release gates satisfied. No spending or new subscriptions.

## Official source references
- Treasury award API: https://api.usaspending.gov/docs/intro-tutorial
- SAM opportunities: https://sam.gov/opportunities
- SBA SUBNet: https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting/subcontracting-opportunities
- BIA tribal leaders and official 2026 count: https://www.bia.gov/service/tribal-leaders-directory
- Census 2025 government-unit listing: https://www.census.gov/data/datasets/2025/econ/gus/public-use-files.html
