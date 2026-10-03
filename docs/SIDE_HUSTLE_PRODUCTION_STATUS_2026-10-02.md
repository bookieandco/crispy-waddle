# Side Hustle production readiness map — 2026-10-02

## Purpose

This document records the repository-backed production status of every canonical Side Hustle family.

It is not a revenue forecast, priority ranking, or permission layer.

Canonical authority remains:

`Opportunity Core -> Side Hustle Business Factory -> Venture Lab -> canonical experiment/outcome learning -> owning execution subsystem`.

A production-readiness label does not change earned Side Hustle automation maturity and does not authorize outreach, publishing, procurement, bids, trading, spending, or money movement.

## Readiness vocabulary

| Status | Meaning |
| --- | --- |
| `validation_ready` | Discovery/research/experiment contracts exist, but the family still lacks a complete dedicated delivery/provider runtime. |
| `execution_spine` | The owning subsystems already provide meaningful governed execution primitives; the family still needs one or more provider/service/outcome certifications. |
| `adapter_ready` | A provider-neutral governed adapter/execution path exists, but a real live transport/provider is intentionally not bound or certified. |
| `live_candidate` | The execution stack is substantial enough for a controlled live commercial canary; real commercial outcome evidence is still required. |
| `capability_only` | Supports other businesses but is intentionally not treated as a standalone Side Hustle execution business. |

## Portfolio snapshot

- Validation ready: **14**
- Execution spine: **8**
- Adapter ready: **1**
- Live candidate: **2**
- Capability only: **1**
- Total families: **26**

## Family-by-family status

| Family | Status | Main remaining production milestone |
| --- | --- | --- |
| AI Business Implementation | validation_ready | Define a canonical implementation work package/delivery receipt and prove one paid pilot. |
| Business Automation | validation_ready | Build workflow-audit -> deployment -> rollback/acceptance delivery runtime and prove measured ROI. |
| Business Systems Installation | validation_ready | Add reusable installation templates, acceptance evidence, and one paid implementation outcome. |
| Lead Generation & Growth | execution_spine | Bind an authorized outbound provider and prove lead delivery through attributable customer outcome. |
| AI Discovery / SEO | execution_spine | Generalize owned-web AEO adapters and ingest real query/citation/traffic evidence on a paying customer. |
| Content & Social Operations | execution_spine | Certify provider-backed scheduled publishing plus analytics and a paid service outcome. |
| Creative / Advertising | execution_spine | Package Director + Growth into a paid creative/campaign service and capture contribution economics. |
| Media Production | live_candidate | Run one paid Director production job through quote, review, delivery, acceptance, and realized margin. |
| Owned Media | validation_ready | Bind first-party channel analytics and a governed publish loop; run an evidence cycle before scaling. |
| Creator Monetization | execution_spine | Unite sponsor/affiliate/product/member revenue receipts around one creator property and prove repeat monetization. |
| Digital Products | validation_ready | Build generic catalog, entitlement, digital delivery, refund, and payment lineage. |
| Software / Apps | validation_ready | Create canonical Builder prototype/deploy/rollback/subscription handoff and prove one paid software commitment. |
| Paid Communities | validation_ready | Bind membership/entitlement/renewal/moderation provider and prove recurring member value. |
| POD / Personalized Commerce | live_candidate | Finish Printify catalog/sample certification and execute one controlled live order through outcome learning. |
| Commerce & Affiliate | validation_ready | Bind an affiliate network and reconcile clicks, conversions, reversals, payouts, and contribution. |
| Dropshipping / Product Commerce | adapter_ready | Bind and certify one legitimate live supplier transport, then run purchase -> fulfillment -> customer outcome. |
| Drop Servicing | validation_ready | Add provider quote/SLA/assignment/delivery/acceptance runtime and prove one margin-positive job. |
| Directories / Marketplaces | validation_ready | Pick one vertical and build listing lifecycle, moderation, entitlement, billing, and demand-density evidence. |
| Physical Asset Businesses | validation_ready | Pick one low-capital asset model and build inventory/booking/custody/maintenance receipts before scaling assets. |
| Boring Business Services | validation_ready | Productize the first repeatable service with QA, delivery acceptance, and paid outcome evidence. |
| Research Services | execution_spine | Standardize research brief/provenance/deliverable/acceptance and complete one paid engagement. |
| Procurement / Subcontracting | execution_spine | Populate live prime/work-package/provider evidence and take one governed teaming opportunity to realized outcome. |
| Website Revenue Systems | validation_ready | Define one deployment stack with CRM/analytics/rollback and prove baseline-to-conversion improvement. |
| Human Premium Services | validation_ready | Select one premium service and build intake/scheduling/delivery/acceptance while keeping human delivery explicit. |
| Trading / Investing Intelligence | capability_only | Keep execution and money movement under Money/Coffer; expose intelligence only as governed context. |
| PR / Authority Building | execution_spine | Bind legitimate media/contact research/outreach and prove placement/discovery outcomes without fabricated proof. |

## Strongest near-term live paths

The repository has the most complete execution machinery in these lanes:

- POD / Personalized Commerce — PupsonStuff, checkout/order persistence, Printify commissioning, creative/3D stack.
- Media Production — Director production/review/generation/certification stack.
- Procurement / Subcontracting — SAM/public discovery, provider research, work packages, Relationship Core, prime/sub matching.
- Content / Social / Creative / Growth — governed Social publication, Director production, Growth attribution and paid-media control.
- Dropshipping — certified governed supplier spine, currently waiting on a real live supplier transport.

These are not declared permanent priorities. The Business Factory should still choose experiments from current demand/evidence and realized economics.

## Shared production law

Every family still flows through:

`market signal -> canonical Opportunity -> research gates -> validation admission -> bounded experiment -> realized outcome -> memory -> maturity assessment -> owning executor`.

The readiness registry lives in:

- `packages/opportunity-core/src/domain/side-hustle-production-status.ts`
- `/opportunity/side-hustles`
- `/opportunity/side-hustles/[family]`

Every readiness record keeps:

- `externalActionAuthorized=false`
- `moneyMovementAuthorized=false`

Trading/investing intelligence remains explicitly capability-only and does not receive standalone Side Hustle experiment authority.
