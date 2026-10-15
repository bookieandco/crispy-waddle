# SHARK WATCHKEEPER.02 → .04 — Code Complete, Live Commissioning Blocked

**Date:** 2026-10-14 America/Los_Angeles.
**Scope:** Draft PR #1286 on branch build/shark-watchkeeper-paper-20261014.
**Modes:** Offline, keyless, non-executing. No data collector, LLM provider,
wallet, signing, orders, real funds, Supabase DDL or AWS/Vercel/Railway charges.

## .02 — Solana DEX execution-cost research benchmark

Source: ops/meme/dex_cost_benchmark.py
Test: ops/meme/test_dex_cost_benchmark.py

- Input consists of operator-supplied **single-pool** PumpSwap or Raydium
  AMM V4 direct-pool indicative route snapshots (not a Jupiter aggregate).
- Requires a separately trusted program ID configured by the operator;
  pool + base/quote vault-mint mapping attested independently, matching
  quote pool/slot/mints and quote/FX evidence with <=20s available age.
- Only constant-product pool reference math is supported. It does not
  silently reuse CEX order-book models, CLMM math, DLMM math or Pump.fun
  pre-migration bonding-curve equations.
- Output distinguishes pool-spot-vs-indicative quote cost, reference AMM
  output disagreement, user-set minimum-output tolerance, and
  network/priority fees using time-scoped SOL/USD evidence.
- Quote output already includes venue/pool fees and price impact: the
  benchmark does **not** double-add its separately reported poolFeeBps.
  Max user slippage tolerance is **not** treated as realized slippage.
- Absent, stale, untrusted, inconsistent, excessive-participation, or
  above-reference quotes are rejected, NO_FILL or UNSCORED.
- It **does not** prove token sellability, LP control, transaction inclusion,
  actual gas consumption, realized execution or capital profitability.
  All test input is synthetic. No live RPC/DEX provider called.

## .03 — Review-only strategy proposal ledger

Source: ops/meme/strategy_proposal_journal.py
Test: ops/meme/test_strategy_proposal_journal.py

- Reuses the existing watchkeeper paired forward-paper grade. Only
  PROPOSE_STRATEGY_REVIEW may yield an inert hypothesis text proposal.
- Binds strategy, regime, SHA-256 of hard risk limits, watchkeeper receipt,
  and scorecard digest. Strict structured allowlist rejects additions
  such as max-slippage modifications or hidden execution controls.
- Proposals and operator-declared REQUEST_PAPER_TEST/REJECT decisions
  append to a SHA-256 chain with single-host POSIX file locking, fsync
  and existing-head verification. No overwrite / replay or duplicate review.
- Owner identity and approval signatures remain **unverified**; an operator
  declaration never authorizes unattended paper running, real trades,
  funds access or automatic rule promotions. Hash chains are tamper-evident
  only against externally retained anchor digests.

## .04 — Sealed forward cohort and explicit incomplete restore

Source: ops/meme/forward_validation.py
Test: ops/meme/test_forward_validation.py

- Requires the .03 PROPOSED + REVIEW_DECLARED chain (with human
  paper-test-request disposition) before sealing fixed strategy, market
  regime, hard limits, arms, independent groups, source head and cases.
- Prospective outcome observations must become available strictly after
  the seal, remain before the evaluation cutoff, and use quote evidence
  that was likewise available *after* the seal. No retroactive price/quote
  reassignment. No strategy ID substitution, duplicate independent-group,
  extra posthoc cohort member or future markout.
- MISSING cases are explicitly UNSCORED rather than filled/backfilled.
  Existing watchkeeper grades only compatible DEX_ROUTE_COUNTERFACTUAL
  paired arms. Spot-only DEX Screener markouts cannot satisfy this contract.
- A local restore check verifies complete SHA-256 byte identity and
  internal journal hash linkage. It **cannot** prove an independent
  Google Drive download, full PostgreSQL dump, schema/row restoration,
  external signing/witnessing or platform recovery.
- Output status is deliberately INCOMPLETE_EXTERNAL_CERTIFICATION even
  when synthetic test cases earn a descriptive strategy-review vote.
  Genuine forward fills, owner-signed approvals, external checkpoint
  anchoring and independent full-database restore remain unverified.

## Local test/CI commands

    python -m unittest discover -s ops/meme -p 'test_*.py' -v
    python -m compileall -q ops/meme

The existing GitHub workflow jhadina-meme-7day-safety-ci.yml already runs
both commands for all ops/meme test files on the draft PR. Source checks
and synthetic regression successes are not production readiness.

## Operations boundaries

Current October 13–20 seven-day memecoin observations: distinct public
mints, indicative routing and NO_TRADE observations, **zero confirmed paper
entry/exit fills**. Do not fabricate .04 outcomes from this data.
Swlc Supabase remains Free-tier read-only due to quota overage;
SHARK ingress migration is not deployed. See #1110, #1257 and draft #1285.

**Remaining external milestones** (not code omissions): establish authentic,
independent Solana pool/quote/cost/exit receipts; seal before a genuine
forward observation cohort with independent immutable timestamp witness;
capture actually reviewed owner signature and keep all hard limits;
independently archive + download + restore full Swlc PostgreSQL safely;
reconcile migration drift, table/RLS policies, and deliver signed readbacks;
then certify with non-censored empirical evidence. Until that day:
NO MONEY / NO LIVE ORDERS / NO AUTONOMOUS PROMOTION.
