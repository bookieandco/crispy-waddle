# SHARK-SNIPER.CONTINUITY.11–.15 — 2026-10-23

Parent: draft #1499 -> #1497 -> #1457.
Branch: `build/shark-sniper-continuity-11-15-20261023`.
**Delivery state: code/test/docs only. No deployment or production mutation.**

## Changes

### .11 — unresolved exits are never fake-closed
`packages/money-core/src/sniper-exit-sentinel.ts` now prioritizes
`UNRESOLVED_PREVIOUS_ATTEMPT` even if a new position snapshot says zero
tokens. Without independently reconciled settlement, zero displayed inventory
must not be interpreted as a completed sell. Independent no-position state
remains available when there is no pending exit.

### .12 — every expired candidate belongs in the observed denominator
`runSniperLivePaperTick` now durably writes `ENTRY_EXPIRED` with explicit
`NO_ORDER_OR_PAPER_FILL` reasons for each original queue item that aged
out. It still schedules exit reconciliation and open-position monitoring
first. Expired entries generate no DEX query, simulated fill or Purse credit.
A failed journal append propagates; it cannot report a completed paper tick.

### .13 — harden on-disk replay
`createFileSniperPaperMonitorStore` and the replay projector refuse unknown
privileged fields, mismatched record identity, and symlink/insecure files on
same-ID retry. Equal identity, altered content triggers conflict. Corrupted
records are not silently skipped or repaired into alleged trades.

### .14 — journal-only continuity accounting
`summarizeSniperPaperCoverage` counts only committed/latest per-work-ID
receipts, separates expired entries, papers, missing evidence, NO_TRADE and
exit reviews, and lists exit-review work requiring follow-up. It emits
`sourceLaunchCoverage='UNKNOWN'`, `liveExecution='NOT_AUTHORIZED'`,
`alwaysOnCertified=false` and `canTrade=false`.
Counts from this local log are **not** a true on-chain launch denominator,
proof of filled orders, recovered money, running-host availability or
independently verified profitability.

### .15 — regression and commissioning gate
Adds tests for false no-position, queue expiry durable recording and
crash failure, checksum/symlink tampering, deterministic receipts, and
journal-only paper cohort statistics. SHARK CI includes the new suite and
Money exit tests. All exact-head GitHub checks must pass before a merge.
No RPC, Phantom, Telegram, Solana signing, network paid provider, Vercel
deployment, Railway worker activation or live orders were triggered.

## Re-verified blocker inventory
- On 2026-10-23, connected Jhadina Supabase still lacked
  `money_shark_sniper_intel_archive` and the five expected
  `money_shark_shadow_*` tables. The local receipt journal is **not** a
  production substitute. Apply migrations only after independent approval,
  migration dry-run, RLS/privilege review, and rollback plan.
- No deployment for the #1499 source branch was found in its Jhadina Vercel
  project. The owner canary remains explicitly default-disabled.
- Historical ~600ms launch receive timing is a fixture/example, NOT a measured
  end-to-end SLA, inclusion probability, entry-to-exit duration or profitability.
- The deployed Telegram Railway staging worker remains deliberately held;
  this work does not activate Telegram authentication or message ingestion.
- Owner Phantom ownership recognition is not Coffer signing authority.

## Next real-world acceptance (separate permission)
1. Reconcile exact-head CI / draft dependency order: #1457 -> #1497 ->
   #1499 -> this child, with #1455 and #1496 selectively reviewed.
2. Approve a separate, PRIVATE, owner-only read-only host and owner-protected
   Vercel preview. Check project/team, budget, networking/volume/kill controls
   and canonical source rights first; this source PR authorizes no release.
3. Prove provider chain event/slot and local receipt time, sampled actual
   p50/p95/p99 timing, coverage denominator including discovered/missed mints,
   fixed host rate-limit compliance and provider disconnect/reconnect.
4. Prove 1h, 4h, 24h retrospective *outcome follow-ups* without lookahead;
   distinguish observed price marks, indicative routes and actual paper fills.
5. Kill/restart a dedicated private collector and verify no lost queue item,
   extra trade, bad persistent volume or corrupted receipt.
6. Reconcile durable canonical SHARK and Shadow storage in an isolated DB,
   then owner-visible iPhone status and alerts. Confirm private login works.
7. A distinct, documented real-money approval must precede Coffer funding,
   signer leases, DEX broadcasts, MEV routes or autonomous exits.
