# Jhadina free-first creator collaboration engine — 2026-10-15

## Build decision
Recreate useful **workflow concepts**, not proprietary source, branding, creator directories, publisher inventory, gated APIs, or protected content from Social Cat, Stack Influence or Realize. No paid subscription, account authorization, scraping, bulk outreach, fund movement, ad activation, new runtime authority or production schema changes are permitted by this source patch.

## Canonical reuse
- Growth Core is responsible for ranking opted-in creator leads, campaign economics, evidence-backed outcome assessment. The new `creator-marketplace.ts` uses existing `CreatorEvidence`, `CreatorFitAssessment`, `assertCreatorEvidence`, and `calculateCustomerEconomics`.
- Social Core owns governed social accounts, immutable publication and approvals, creator/content lineage and exact brand identity.
- Action Core is required for any public message, product send, reimbursement, spend or publish.
- Commerce/Offer/Money own verified order, inventory, payout, product pricing and cost truth.
- Director retains creative generation, QA and asset provenance. No duplicate scheduler or learning engine.
- Existing Growth A/B tests and paid-media readiness handle future controlled creative experiments.

## Feature map
| Inspiration | Available as open, free-first equivalent | Not part of this patch |
| --- | --- | --- |
| Social Cat | Evidence-based creator matching, niche/affinity scoring, opt-out and permitted-contact gates, collaboration proposals | Social Cat's proprietary database or automatic campaign applications |
| Stack Influence | Product seeding/reimbursed-order cash-cost estimate, missing-quote detection, UGC rights/proof/expiry/revocation | Its managed creator network, paid reimbursements, logistics or guaranteed posts |
| Realize | Use existing Growth experimentation and contribution economics; a manual-report-only provider registry entry | Taboola's distribution inventory, ad auctions, pixel, buyer data, proprietary targeting or paid impressions |

## Default risk controls
- `authorizedExternalSpendUsd` is statically `0`; no external execution function exists.
- Positive planned cost always produces `OWNER_SPEND_APPROVAL_REQUIRED`. Unknown cost `null` produces `QUOTE_MISSING`, never fictitious free cost.
- Creator sample self-checkout is offset against the matching reimbursement for estimated marketing cost, but is never counted as newly acquired customer revenue.
- An outcome can only be assessed for an exact owner+brand+campaign and must contain evidence references, with observed external customer revenue and costs. Results are observations, not authorization to scale.
- UGC reuse checks exact owner/brand/creator/asset, explicit licensed channel, signed-rights evidence reference, revocation and expiry. An in-scope result permits only *drafting a proposal*, not republishing.
- The mobile page `/social/collaborations` is **browser-memory planning only**. User-entered creator facts and contract references are attestations. No persistence, account binding, third-party connection or deliverability is claimed.

## Path to a real, free pilot
1. Verify CI and reconcile pending Social approvals/identity PRs before merging; do not transplant old schedulers.
2. Add canonical owner-authenticated persistence and RLS for prospects, quotes, signed rights, suppression records and receipts. Do not persist preview-only owner placeholders.
3. Add manual authorized CSV/JSON import with source timestamps, opt-outs, consent tracking and dedupe. No login scraping or automated mass DMs.
4. Bridge exact creator proposals through existing Growth outreach draft -> Social immutable weekly packet -> Action Core permit. No autonomous sending.
5. Import actual cost from suppliers and purchases from commerce; use existing attribution/experiments and weekly review. Label missing data unknown.
6. Run organic pilots for PupsonStuff and Atwood Bookie, then evaluate paid providers only with owner-approved budgets and validated unit economics.

## Certification
This branch is **source-only** until GitHub CI, merge, authenticated durable storage and device QA. It does not connect or commission Social Cat, Stack Influence or Realize. FTC paid/gifted-collaboration disclosure and copyright/license obligations still apply.
