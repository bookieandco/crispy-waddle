# SHARK-SNIPER.FASTLANE.RECOVERY.01–.05 — time-critical memecoin lifecycle

Date: 2026-10-22 PDT. Source branch: `build/sniper-fastlane-expiry-exit-priority-20261022`.
Parent: `build/shark-sniper-fastpath-rug-fingerprints-20261021` / draft PR #1457.

**Delivery: source-only code + tests, draft PR. No merges, deployment, paid
provider, Telegram activation, wallet signer, transfers, funding or live orders.**
The existing canonical path remains Helius/Pump evidence → SHARK rug/sellability
→ Money quote/fee/exit + paper → Shadow Learn/Purse research. No cloned engines.

## Why "fast" means the whole lifecycle

A coin may become untradeable before its terminal market snapshots. Entry speed
cannot be judged from a 600ms timestamp example or p50 alone. Track and improve:
- chain event → provider observation → webhook receipt (provider timestamp resolution);
- receipt → verified launch evidence → risk/creator/cluster/sellability;
- risk → two-sided executable route quotes + fee/priority/tip cost → entry deadline;
- order submission → landed/confirmed (only where a real authorized route exists);
- confirmed open position → fresh reverse quote → exit submission → settled return;
- research decision/no-trade/unknown outcome → durable archive and later Shadow learning.

Do not infer actual subsecond chain discovery or profits from unit-test clocks,
provider-reported seconds, an onchain ownership signature, or price-only market marks.

## Delivered in this branch

**FASTLANE.01 — one entry clock.** `sniper-opportunity-clock.ts` enforces
operator-supplied max launch age, provider-to-receipt lag, risk evidence age,
selected quote age and minimum order-expiry remaining time. It preserves the
immutable original event time: refreshing a quote cannot revive an expired mint.
Invalid chronology throws, missing selected quotes/order expiry fail closed.
All outputs are timing/research-only with `canSubmit=false`, `canExecute=false`.

**FASTLANE.02 — exit-first pressure.** An already open position or unresolved
exit is `EXIT_PRIORITY` even if the launch timestamp is old. A bounded,
stable work-queue planner orders `RECONCILE_EXIT` > `MONITOR_EXIT` >
`RESEARCH_ENTRY`. Old entry work may expire; old exit work must not be
silently discarded. Planner does not poll providers, sign or execute.

**FASTLANE.03 — Money selected-quote binding.** Optional `fastlane` input to
canonical `runSniperPaperCycle` checks that the timing evidence ID matches
Money's *selected* quote. A mismatched, unknown, stale or expired quote blocks
a paper entry; it never falls back to another quote or an invented price.
Consumers not providing `fastlane` retain legacy behavior until separately
migrated and independently verified. Thus this is **not a universal live gate**.

**FASTLANE.04 — safe intake retries.** `SniperFastpathDiscoveryIntake` does
not populate process dedupe on invalid monotonic timestamps and releases a
temporary dedupe key when its observer throws. Database idempotency remains the
cross-worker authority. No source provenance is cryptographically attested by
this change.

**FASTLANE.05 — measured stage telemetry.** `summarizeSniperStageLatency`
adds p50/p95/p99 by *actual recorded stage pair*; skipped/missing steps are
never invented. Measures are descriptive research until authentic scheduled
collection, producer/slot verification and independent submitted/landed
receipts are enabled. Regression tests and SHARK CI cover clock, queue,
selected-quote binding, ingestion retry and staged timing.

## Operational acceptance, in order

1. Review exact-head CI of parent #1457 and child. Run SHARK, Money R13B,
   integration type-check, Jhadina Launch Gate and owner-private device tests.
   Preserve #1455, #1496 and unmerged Shadow recovery work; no bulk merge.
2. Verify source timestamps and availability receipts against canonical
   Solana transactions. Instrument provider network latency and reconnect gaps,
   *including missed launches*. Measure p50/p95/p99 by source/venue/stage
   and report success/failure/unknown denominator.
3. Do a source-only or approved read-only durable-collector acceptance with
   bounded queues, backpressure, idempotent replay, real independent quotes and
   aged-candidate discard. Telegram and social signals are hypotheses, not
   signing instructions. The Railway Telegram staging worker currently runs
   an intentional inert hold.
4. Repair missing `money_shark_shadow_*` storage and stage the proposed
   `money_shark_sniper_intel_archive` migration in an isolated database;
   certify RLS, privileges, hash, duplicates, crash/retry, then separately
   review production schema and operator-controlled deployment.
5. Prospective paper study: record entry/no-entry candidates, quote expiry,
   failed landing, gas/tip/priority cost, false rug positives/negatives,
   reverse-path sellability, partial exits, unresolved exposure, and realized
   paper P&L separately from actual onchain cash. Supply original timestamps.
6. Owner-private iPhone status must show stream healthy/stale/offline, newest
   event age, p95/p99 stage timings, open position and pending exit, paper
   versus settled receipts, and explicit NO TRADE authority.
7. Only a separate authorization could later commission Coffer custody,
   real quote routing, spending caps, nonce/signer leases, emergency kill
   switch, onchain reconciliation and strictly bounded initial canary.

### Blocking reality
- Verified owner Phantom is observer-only and does not authorize signing.
- Connected Jhadina database had zero rows in SHARK market/trade/paper tables
  at the October 22 audit. The new archive and five Shadow schemas were absent.
- No measured 0.6s end-to-end SLA, independently proven profitability, or
  running real-order engine has been established.
- This branch introduces no capital actions and cannot credit Jhadina's Purse.
