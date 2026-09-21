# SH reference audit — freelance + digital-product sources

Date: 2026-09-21
Branch: feat/sh-recon-dropshipping-certification

## Sources

- GitHub topic: freelance-work, sorted by stars
- SuperteamDAO/earn
- worknenjoy/gitpay
- digital-marketing-engineer/awesome-freelance-developer-resources
- ncreighton/b0f84f9ddc8bb04e-ai-productivity-pdf-report-gen
- ckw19810413/digital-product-research

## 1. freelance-work topic

GitHub currently reports 322 public repositories under the topic. The highest-starred visible projects include SuperteamDAO/earn, Gitpay, and a curated freelance-developer resource list.

### Useful patterns

**Superteam Earn**
- Bounty/project marketplace model.
- Opportunity shape: bounty, project, sponsor/client, reward, skills, deadline, submission state.
- Maps to Opportunity -> Placement.
- Useful for a new freelance source family: bounties/project work in addition to conventional jobs/gigs.
- Crypto/Web3 payment mechanics are not imported into Placement or Money. Payment rails remain Money-owned and separately governed.

**Gitpay**
- Work tied to Git/GitHub issues and delivered changes.
- Useful concept: source opportunity from a concrete issue/task, preserve repository/issue identity, proposed reward, deliverable and acceptance state.
- Maps to Opportunity -> Placement, with GitHub as the evidence/source connector.
- Payment/execution authority must not be copied.

**Awesome Freelance Developer Resources**
- Useful as a provider/skill taxonomy seed.
- Contains job-board/provider candidates and a large skill/role vocabulary.
- It also explicitly lists inactive providers, which reinforces Jhadina's requirement to revalidate every provider before promotion from reference/contract-only to adapter-ready/live.
- Do not import its rankings as current labor-market truth without fresh evidence.

### Jhadina implication

Freelance should support opportunity subtypes without creating another authority:
- freelance_project
- bounty
- paid_issue
- fixed_scope_service
- contest
- contract_gig

Placement remains pursuit/execution owner. Opportunity remains discovery/evidence/ranking owner.

## 2. AI productivity PDF report generator

The repository currently contains only a README. There is no report-generation implementation to import.

Useful productization pattern:
- free/basic vs pro/premium packaging;
- branded PDF/report as a sellable digital product;
- one-time checkout/upsell;
- template/support/update bundle.

Disposition: CONCEPT_ONLY.

Map to:
Opportunity -> digital_product -> Director/Document generation -> Commerce listing/sale.

Jhadina already has document/PDF creation capabilities, so this should become a product recipe, not a new PDF engine.

## 3. digital-product-research

This is the strongest reference of the three for Jhadina's side-hustle intelligence.

Reusable research loop:
1. collect sales/product telemetry;
2. evaluate trigger conditions;
3. classify bottleneck;
4. run targeted research;
5. produce findings;
6. propose next actions;
7. measure outcome and rerun.

Useful bottleneck categories:
- market trend;
- conversion funnel;
- competitor/pricing;
- product-potential;
- promotion;
- pricing elasticity/benchmarking;
- marketing-channel ROI/CAC/conversion;
- refund/quality friction;
- launch/readiness gaps.

The repository uses explicit numerical trigger examples, but those thresholds and its performance claims must be treated as unverified reference hypotheses rather than Jhadina defaults.

### Correct Jhadina placement

Opportunity / Growth intelligence:
- observed actuals from Money/Commerce/Attribution;
- deterministic trigger evaluation;
- ResearchIntent for missing evidence;
- competitive evidence;
- recommendation generation;
- explicit experiment proposal;
- user/policy approval for consequential changes;
- Money/Attribution actuals feed the result back into Opportunity learning.

This should not become another analytics database or independent automation engine.

## Recommended architecture addition

Add a reusable **Opportunity Bottleneck Monitor** later, parameterized by side-hustle vertical.

Inputs:
- revenue;
- gross/net margin;
- conversion;
- traffic;
- refunds;
- CAC;
- channel concentration;
- product freshness;
- competitor movement;
- fulfillment failure rate;
- hours invested.

Output:
- observed bottleneck facts;
- inferred bottleneck signals;
- research tasks;
- recommended experiments;
- no automatic consequential action.

## Priority

HIGH:
- digital-product bottleneck research loop;
- freelance bounty/paid-issue opportunity shape;
- freelance provider freshness verification.

MEDIUM:
- branded report/PDF product recipe.

REFERENCE ONLY:
- platform lists/rankings;
- numerical benchmark claims unless independently sourced;
- external payment/escrow implementation;
- crypto rails;
- automatic applications/submissions.
