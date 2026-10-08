# MONEY-FINISH.11–.12 — Strategy Factory, holdout lockbox, Jhadina Market-IQ and Make It Make Sense
As-of **2026-10-08**, repository `bookieandco/crispy-waddle`, `packages/money-core`.

## Dependency graph and code truth
`main` ← [#1170 P0 contracts](https://github.com/bookieandco/crispy-waddle/pull/1170) ← [#1171 read-only feeds](https://github.com/bookieandco/crispy-waddle/pull/1171) ← [#1173 quant research](https://github.com/bookieandco/crispy-waddle/pull/1173) ← **this PR**. Earlier PRs were still open when this branch was created. This change is stacked, **not on main**, and must be reconciled in order with exact-head CI.

## FINISH.11 — research candidate registry and one-time holdout
`src/money-finish-strategy-factory.ts` provides:
- Explicit algorithm family, instrument, asset, parameter and methodology version, code/data provenance IDs, point-in-time cutoff and SHA256 fingerprint. Sorting parameter keys makes equivalent candidate inputs reproducible. A failed integrity assertion rejects later parameter mutations.
- A per-candidate **development trial budget**: each trial requires unique ID, archived dataset snapshot hash, label-maturity/evaluation timestamps, sample size, gross-minus-cost net return, maximum drawdown, and evidence IDs. Attempt count is recorded even if the result is adverse. Development cannot continue after freeze.
- An **in-process sealed evaluation lockbox** whose public manifest has case IDs, first decision timestamp, latest label-maturity timestamp and opaque commitment hash but **no label values**. Candidate specifications and all holdout directions are frozen *before* the earliest holdout decision; one evaluation is permitted after all labels mature plus configured embargo; invalid/partial/duplicate predictions and tampered fingerprint are rejected. Historical-grade reports clearly say `HISTORICAL_HOLDOUT_RESEARCH_ONLY`, with total cost subtraction, win rate, max drawdown, experiment-count and multiple-testing warning. The returned summary never grants portfolio, funding, broker, or live authority.
- The lockbox is **in-memory** and labels are known to the process owner. This is **not secure physical custody, durable storage, a blinded external evaluation service, or proof of prospective investment performance**. Restart, concurrent-writer coordination and independent vault custody require separate database/infrastructure work. No automatic strategy deployment or loop was started.
- References the existing `autonomous-strategy-learning.ts` paper record and `paper-strategy-result.ts` outputs; it does **not** bypass their genuine-close and fee-quality checks, or copy upstream strategy implementations.

## FINISH.12 — empirical/causal vote and non-executable Market-IQ bridge
`src/money-finish-market-iq-mims.ts` provides two **independent** judgments:
1. **Coherence:** explicit assumptions, causal chain with cycle detection, contradictions and alternate explanations. Internally coherent stories do not become facts.
2. **Evidence quality:** independent timestamped/provider evidence, contradictory studies, direct vs indirect vs anecdotal evidence, research rights, alternative hypotheses and source-backed base rates. No evidence known as of the cutoff may be read from the future. Outcome `SUPPORTED` remains `truthStatus: NOT_ESTABLISHED`: it is research support, not truth, calibration, or profitability.
3. **Risk and authority:** consumes a verified instrument-bound research artifact, candidate hash and optional holdout-grade provenance; hard risk/data rights fail closed. Emits existing `DecisionCase` and `DecisionAssessment` shaped for Jhadina/Market-IQ without granting Action/Money Core proposals: `authorityStatus: NONE`, `disposition: RESEARCH_ONLY` or `BLOCKED`, and `canExecute/canAuthorizeLive:false`. A caller can demonstrate `assertProposalEligible` rejects the results. Jhadina's expressive reasoning may explain the vote, but cannot upgrade the machine status.

Note: **#1098 Market-IQ bridge** was independently open in the prior audit and must be reconciled before wiring these contracts into production interfaces; this PR exports a typed source-artifact bridge, **not a commissioned Market-IQ worker or remote call**.

## Scope and negatives
- No model training against licensed market data, unblinded optimizer, overfit edge certification, live broker order, user money movement, paid infrastructure, wallet access, or new trading entitlement.
- No real Strategy Factory scheduling, distributed transactional registry, DVC holdout custody, experiment warehouse, multi-cycle live-paper evidence or original Shadow backup proof. Commission these in FINISH.13+. Baseline portfolio profitability remains unproven.
- Unreviewed provider rights, future evidence, incomplete risk, or missing source receipts cannot authorize autonomous action. Financial constraints and manual owner approval remain independent.

## CI and next sequence
`MONEY-FINISH.11–.12 Strategy Factory MIMS` runs frozen install, full Money Core TypeScript, targeted negative tests for candidate/holdout/risk/market provenance, then all Money Core unit tests. Record **exact PR head** and pass/fail. Do not claim runtime certification from these fixtures.

Next: `MONEY-FINISH.13 → .14` — immutable strategy-incubation state machine and deterministic health pause, true historical data repair and original Shadow recovery verification, durable live-paper ingestion/grading and multi-cycle watchdog. Any Supabase/RunPod-dependent actions without a valid host, provider license and source-volume receipts stay blocked for audit/repair.
