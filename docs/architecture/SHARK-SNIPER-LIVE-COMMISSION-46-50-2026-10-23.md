# SHARK-SNIPER.LIVE-COMMISSION.46–.50 — guarded handoff
2026-10-23 · Source-only · Draft child of #1509 → #1508 → #1506 → #1505 → #1504 → #1503 → #1501 → #1499 → #1497 → #1457.

## Executive acceptance
Coding deliverables have been staged in a new source branch. **No production
migration, distributed signer, 24-hour feed, funded Coffer, real order or
commissioned autonomous execution has been established.**

### .46 — Research-only PostgreSQL atomic gate
- Reuse the **existing** canonical Money
  `money_execution_permits` and `money_live_canary_state`.
- A staged migration `packages/money-core/migrations/031_shark_sniper_coffer_research_gate.sql`
  introduces a wallet-scoped research-policy row, a unique research hold
  table, and a privileged PostgreSQL function with a wallet-wide
  `SELECT FOR UPDATE` lock. It checks the existing issued Money permit's
  action fingerprint, unhalted/fresh canonical canary state, zero unresolved
  orders, research-only daily/order/loss caps, and unique idempotency,
  execution and permit IDs **in the same transaction**.
- Default database policy has `research_enabled=false`,
  `permanently_halted=true`, `live_signing_enabled=false` with a CHECK
  prohibiting TRUE. RLS enabled and function `SECURITY INVOKER`.
  EXECUTE/table grants are revoked from PUBLIC, anon, authenticated and
  service_role. No production credentials or caller privilege grant created.
- The typed `PostgresSniperCofferResearchGate` verifies the existing Money
  ActionRequest and Action Core permit in code, passes parameterized SQL
  and always returns `canSign=false`, `canSubmit=false`,
  `canBroadcast=false`, `canCreditPurse=false`.
- **This is an atomic research admission, not an atomic live Money permit
  consumer, not custody and not the existing canonical reservation store.**
  It must NOT be connected to the live submitter as an authority or
  reported as preventing real distributed double-spends.
- SQL has been checked against existing Supabase column types, including
  TEXT `trading_date`. It has **not** been applied or run in isolated
  PostgreSQL yet; a live migration remains blocked pending approval and
  isolated schema/RLS/ACL/concurrency tests.

### .47 — Coffer + signer commissioning envelope
- Preserve main Phantom wallet as owner observation wallet. A separate
  Coffer wallet must be independently custody-verified before funding.
- No secret, private key, mnemonic, production signer lease or actual
  wallet signing service introduced in this code sequence.
- `sniper-live-commission-readiness.ts` requires owner iPhone QA,
  unauthorized-user preview denial, independent RPC and message byte proof,
  isolated signer, **atomic signer-side** Money permit/budget reservation,
  revocation drill, unknown-settlement restart drill, and user-approved
  budget/funding. A research CAS alone cannot satisfy the signer-side gate.
- Even when a hypothetical packet meets all evidence criteria, money movement
  remains DISABLED and explicit separate per-leg approval still applies.

### .48 — prospective market intelligence / Shadow dependency check
- `sniper-live-source-cohort.ts` counts every observed launch and
  expired/blocked event rather than backfilling only successful paper picks.
  It computes observed receipt→risk, receipt→quote and receipt→paper-decision
  p50/p95/p99. Unknown intervals remain absent, not zero.
- Provider seconds-resolution timestamps cannot substantiate the desired
  subsecond chain discovery/landing/exit SLA. Source-only fixtures do not
  certify genuine feed coverage or trading performance.
- As of this audit, connected Supabase has Money permit/canary tables but
  still lacks `money_shark_shadow_decisions`,
  `money_shark_shadow_executions`,
  `money_shark_shadow_observations`,
  `money_shark_shadow_lessons`, `money_shark_shadow_memory` and
  `money_shark_sniper_intel_archive`. No schema writes made.
- The canonical SHARK/Shadow table migration and field/RLS integration,
  plus a genuine authenticated Helius event collector, remain
  operationally BLOCKED. Neither a speculative SQL table nor a synthetic
  event count counts as delivered storage or live intelligence.

### .49 — adversarial acceptance and important newly confirmed blocker
- Unit tests cover source clock reversals, duplicate events, missed launch
  denominator, no real end-to-end SLA, research permit provenance, forged DB
  success, rejected DB calls, protected SQL ACL defaults, revoked/stale
  signer status, fake buy/sell routes, missing schema and budget approvals.
  Previous #1509 crash/timeout/unknown exit and signing veto suites remain.
- **Unresolved live runtime crash window:** In
  `dex-controlled-canary-runtime.ts`, `signer.signVersionedTransaction`
  occurs before `attemptStore.put(attempt)`. A process crash after signing
  but before durable signed-attempt persistence can leave ambiguous state.
  The new research-only admission does not fix this. The real-money
  execution path must first implement durable pre-sign intent/nonce/hold
  persisted in the SAME authority as the signer, plus reconciled recovery
  before any automatic retry. An operator should treat this as a mandatory
  stop condition, not a harmless TODO.
- Distributed fault injection in real PostgreSQL, production RPC failure,
  kill -9 on a persistent host, and actual signed settlement are NOT
  certified by hermetic unit tests.

### .50 — owner-reviewed *proposal*, not a live-money permit
- `prepareSniperMainnetCanaryApproval` returns a versioned packet,
  pass/fail blockers, exact missing database tables, evidence counts,
  and proposed caps if supplied. It always returns
  `canSign=false`, `canSubmit=false`, `canFund=false`,
  `canTrade=false`, `canCreditPurse=false`.
- Proposed total/order/daily-loss caps are NOT invented from a past
  chat example. No money amount or signer owner policy is authorized by
  this source change. `READY_FOR_SEPARATE_OWNER_REVIEW` is not permission
  to move capital.

## Minimum next mainnet sequence (separate approval per stage)
1. Exact-head CI and dependency-chain review, compile/migration smoke in
   isolated local PostgreSQL, test RLS function EXECUTE denials and 10+
   cross-process conflicting idempotency operations; **no production apply**.
2. Fix canonical pre-sign persistence crash window. Prove signer consumes
   one durable permit+nonce+budget reservation atomically at the point of
   signing, with no bypass from research holds.
3. Commission a trusted signer-owned RPC and simulation/ALT service,
   real debit/credit verification including Token-2022, inner CPI,
   destination/program/rent/tips, and independent finality.
4. Review and apply canonical Shadow/sniper archive schema after dry-run
   with least-privilege RLS, typed stores, replay and rollback evidence.
5. Authorize bounded Helius receive-only feed and persistent read-only
   collector on an approved host. Gather prospective 100+ events including
   rejects, misses, price-only tokens and sellability/rug findings.
6. Owner tests the protected iPhone preview and unauthorized-user denial.
7. Separately approve isolated Coffer wallet creation/owner custody and
   funding amount, signer controls, max per trade, max daily loss,
   fee/tip/slippage caps, token/program allowlists and emergency stop.
8. After all previous gates, explicitly approve one tiny real BUY.
   Reconcile signed signature, landed/finalized chain receipt, wallet
   conservation, amounts, fees, and unknown outcomes.
9. After the BUY is reconciled, separately approve one tiny SELL and
   verify no open inventory and net-realized proceeds.
10. Only after prospective loss/rug/latency calibration should bounded
    automation be considered under a fresh owner authorization.

No trades, funds, signing, new paid subscriptions, Railway listener
activation, mainnet broadcasts, production merges, schema migrations or
credential changes are authorized or performed by .46–.50.

## Official database privilege model
Supabase function documentation emphasizes that functions may be callable
from PostgREST by default and that definer functions may bypass RLS:
https://supabase.com/docs/guides/database/functions
This migration uses SECURITY INVOKER, explicit revokes and no HTTP grant.
