# JH-REVENUE.01–.04 — reconciliation, source intake and economic gates

**2026-10-22 | Source-only handoff | no production commissioning or earnings certified**

## .01 — Repository reconciliation

- Consolidated Opportunity Core PR [#1480](https://github.com/bookieandco/crispy-waddle/pull/1480) is open **draft**, unmerged. This implementation stacks on its inspected head 567014225d1960d5dad1592a7097cc9ae7d1d55b, not directly on main. The draft contains owner-only iPhone readiness, sourced research and Greenhouse/Lever intake. Exact-head checks, provider terms, true authenticated device/Safari pilot and real customer evidence remain pending. Combined-status API returned no statuses at preflight, which is **not** proof of passing CI.
- Older [#1472](https://github.com/bookieandco/crispy-waddle/pull/1472), [#1474](https://github.com/bookieandco/crispy-waddle/pull/1474), [#1477](https://github.com/bookieandco/crispy-waddle/pull/1477) were draft recovery stages. Do not blindly merge the stack; review the consolidated branch first.
- Purse [#1456](https://github.com/bookieandco/crispy-waddle/pull/1456) → [#1460](https://github.com/bookieandco/crispy-waddle/pull/1460) → [#1461](https://github.com/bookieandco/crispy-waddle/pull/1461) is a separate draft chain: five absent commercial tables, missing backup/restore, missing Stripe signed TEST provider canary and no settled first customer. This PR doesn't modify financial authority.
- Reuse canonical Opportunity Core, existing Zero Rig Superteam scout, fixed-host read transport, eligibility review, owner runtime and Money Core outcomes. No duplicate agent account or ledger.

## .02 — Superteam agent source extension

Preserved: existing Zero Rig official fixed-host live-listing read; requires owner-bound env and agent API key. Existing normalizer rejects human-only, expired, and non-open listings; discovery never certifies payouts.

Added revenue-superteam-details.ts:
- GET-only official /api/agents/listings/details/{validated-slug}; eight-second timeout; rejects redirects, non-JSON and over 256 KiB streaming bodies.
- Compares official detail with discovered ID, slug, title, status, type, agent permission and exact deadline, and computes SHA-256 consistency fingerprint.
- Explicitly never treats total prize pool as individual USD cash or infers eligibility, payout or submission authority.
- Remains a source-only reader until owner-authorized agent registration, server-side credential vault, real response fixture and operator claim eligibility checks.

Primary docs: https://superteam.fun/earn/agents and https://superteam.fun/skill.md

## .03 — Algora / Opire snapshot intake

- revenue-marketplaces.ts is a read-only **observation adapter**, not undocumented web scraping. Accepts official source URLs plus GitHub issue URLs, 24-hour freshness, <=100 observation batches, OPEN status, deduplication, strict domains, bounded title and conditional USD amount.
- All records map into canonical *unverified* Opportunities. No platform guarantee, payment, AI permission, payer identity or competition count is inferred from user/provider text. Opire flagged direct payer/no guaranteed escrow.
- Production automated ingestion **not commissioned**. First independently establish a sanctioned API/feed or manually reviewed source observations; verify license, source payload, payout guarantee, issue ownership and rate limits.

Sources: https://api.docs.algora.io/ and https://docs.opire.dev/overview/getting-started

## .04 — Earned-income score, not trading

- revenue-economics.ts estimates P(completion) x P(acceptance|finished) x P(payment|accepted), subtracting full modeled compute, platform, fulfillment, rework and human opportunity costs.
- Closes on expiry, status, AI prohibition, operator ineligibility, compute budget excess, non-individual prizes, credit/investment/restricted funds. Stale evidence, unidentified payer, direct-pay uncertainty, missing costs/probabilities or saturated/unknown competition stay in *insufficient_evidence*.
- Even a research_candidate is estimation-only and cannot submit or spend. No earned revenue is recognized. This is separate from speculative investment opportunity signals.

## Files / tests

- packages/opportunity-core/src/domain/revenue-superteam-details.ts
- packages/opportunity-core/src/domain/revenue-marketplaces.ts
- packages/opportunity-core/src/domain/revenue-economics.ts
- packages/opportunity-core/src/domain/revenue-gates.test.ts
- packages/opportunity-core/src/index.ts and package.json
- .github/workflows/jh-revenue-01-04.yml

Run on exact branch head:
1. pnpm --filter @jhadina/opportunity-core type-check
2. pnpm --filter @jhadina/opportunity-core exec tsx src/domain/zero-rig.test.ts
3. pnpm --filter @jhadina/opportunity-core exec tsx src/domain/zero-rig-live.test.ts
4. pnpm --filter @jhadina/opportunity-core exec tsx src/domain/revenue-gates.test.ts
5. pnpm --filter @jhadina/opportunity-core test

Tests cover human-only/closed/expired/detail-change restrictions, fixed URL and secret handling, malformed/duplicate/stale marketplaces, direct-payment uncertainty, unsupported pool rewards and costs, probabilities, saturation and hard budget stops. Fixture tests **cannot** prove live provider or financial certification.

## Remaining blockers and next

At handoff: exact-head CI and full package tests **unverified**, live API payload and use-permission not independently certified, missing server key/agent identity, uncommissioned owner mobile and commercial payments, no paying customer or verified earnings.

Next .05 owner-scoped candidate inbox and bounded original-work sandbox; .06 hash-bound per-submission approval; .07 separately authorized commercial DB/Stripe TEST recovery.

No registration, application, comment, bounty claim, payment, wallet signing, live trading, deployment, or merge was performed.
