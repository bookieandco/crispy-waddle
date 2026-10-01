# LOCAL-GOV.6 — State-Specific Compliance Packs

## Purpose

Attach source-backed state compliance evidence to local/public work packages without pretending one state's rules generalize nationally.

## National manifest

The runtime creates a 51-jurisdiction state/DC compliance manifest.

- California: `verified_reference`
- all other states/DC: `discovery_required`

A state remains review-required until its own official source pack is commissioned.

## California reference pack

Version:

`ca-public-works-2026-09-30.v1`

Official reference sources observed on 2026-09-30:

- California DIR — Contractor Registration
- California DIR — Public Works Contractors
- California DIR — Public Works
- California DIR — Prevailing Wage Requirements
- California CSLB — Who Must Be Licensed

The pack models evidence gates for:

- contractor licensing where CSLB licensure applies;
- DIR public-works contractor registration;
- workers compensation or valid exemption evidence where applicable;
- prevailing-wage execution planning;
- apprenticeship planning for qualifying $30,000+ public-works projects;
- certified payroll capability;
- debarment clearance;
- delinquent wage/penalty assessment clearance.

These are evidence requirements, not a legal opinion. Project-specific definitions, thresholds, exceptions, classifications, funding sources and local rules still require source verification.

## Deterministic assessment

Each gate resolves to:

- `pass`
- `review_required`
- `blocked`
- `not_applicable`

Missing facts or unverified evidence produce `review_required`.

Only explicit failed or expired evidence can hard-block a hard gate.

The assessment result always carries:

- `externalActionAuthorized=false`
- `isLegalAdvice=false`

## Durable evidence

Tables:

- `jhadina_public_compliance_packs`
- `jhadina_public_compliance_evidence`
- `jhadina_public_work_package_compliance`
- `jhadina_public_compliance_source_jobs`
- `jhadina_public_compliance_source_candidates`

All tables are service-role-only.

## National source commissioning

`/api/internal/opportunities/public/compliance-sources`

For states whose pack is not yet verified, the source commissioner uses the existing Jhadina search rails:

- configured `WEB_SEARCH_URL` / `WEB_SEARCH_API_KEY`;
- Exa fallback when configured.

It searches for official state sources covering:

- contractor licensing;
- public-works registration;
- prevailing wage;
- apprenticeship;
- certified payroll;
- workers compensation;
- debarment;
- bonding.

Only government-domain, state-relevant, topic-relevant results are verified as source candidates.

Search results **cannot automatically become a verified compliance pack**. Once enough topics are covered, the state moves to `pack_review_required`.

## Work-package assessment

`/api/internal/opportunities/public/compliance`

Each evidence-backed work package is assessed against the pack for its state.

The runtime derives only conservative project context from the existing package:

- public-work status;
- geography/state;
- estimated package value;
- explicit license requirements;
- work-type hints from evidence-backed scope text.

Unknown provider facts, such as employee status, remain unknown and produce review requirements rather than assumptions.

## Scheduler

- minute 20 hourly — package compliance assessment
- minute 35 hourly — state compliance source commissioning

## Authority boundary

LOCAL-GOV.6 does not authorize:

- legal conclusions;
- buyer/prime/provider contact;
- quote requests;
- bid submission;
- teaming commitments;
- contract acceptance/execution;
- payment or money movement.

## Next

LOCAL-GOV.FINAL should certify:

- national jurisdiction hydration;
- source-discovery progress;
- active adapter coverage;
- live opportunity observations;
- awarded-prime/work-package flow;
- compliance-pack coverage and discovery debt;
- restart-safe scheduler evidence;
- end-to-end authority boundaries.
