# SHARK-SNIPER.FASTLANE.LIVE-PAPER.06–.10
Date: 2026-10-22, America/Los_Angeles.
Branch: `build/shark-sniper-live-paper-06-10-20261022`.
Parent: draft #1497, itself based on draft #1457. No bulk merge and no changes to production, funded accounts or wallets.

## Goal and honesty
Memecoin lifetimes can be shorter than a polling interval. Optimize end-to-end
**decision freshness and exposure reconciliation**, not a made-up 0.6-second win
rate. Existing Helius/Pump decoded canonical identity remains the chain source.
An independently verified Solana mint, creator/cluster risk, current two-sided
quote, and actual confirmed sell route are necessary before executing even a
paper fill; a public price feed is never equivalent to those.

Status: **source changes and hermetic tests for a manually invokable,
opt-in read-only paper monitor**. There is no commissioned 24/7 runner,
paid Helius event subscription, deployed scheduler, actual trading or
automatic SHARK-to-Purse profit. The live provider canary was separately
observed as a public DEX profiles GET, not a real-life certified full sniper
session. A public token-pairs GET was not verified end-to-end in this session.

### .06 — Genuine public observations (not new launch proof)
- `sniper-live-paper-feed.ts` permits only bounded fixed-host HTTPS GET:
  `/token-profiles/latest/v1` and `/token-pairs/v1/solana/{mint}`.
- Reject invalid Solana mint/original pair, wrong chain/base token/pair,
  missing or impossible prices/liquidity, future pair creation,
  overlarge or invalid payload and provider 429/HTTP errors.
- Use a post-response *local receipt time*; no fabricated chain slot,
  mint creation timestamp, full launch coverage or executable quote.
- Source: official DexScreener API reference
  https://docs.dexscreener.com/api/reference
  Public profiles are promotion-driven and do NOT cover all births.
- This module does not use arbitrary URLs, credentials, untrusted redirects,
  personal Telegram chats, RPC wallet methods or signing.

### .07 — Full-path observability
- Preserve #1497 per-hop p50/p95/p99 timing (only observed intervals).
- Preserve source, chain/DEX evidence differences and source availability;
  synthetic test values are NOT a verified event→landed-fill 0.6s SLA.
- Absent real landed/submitted/confirmed receipts, do not claim a final
  onchain latency distribution. No actual user wallet execution is measured.
- No speculative invented reverse route or profit from public price only.

### .08 — Repeatable, bounded exit-first paper monitor
- `sniper-live-paper-monitor.ts` calls existing Money
  `orderSniperFastlaneWork` and `evaluateSniperExit`.
- Queue order: `RECONCILE_EXIT` > `MONITOR_EXIT` >
  `RESEARCH_ENTRY`. Expired *new* launches are dropped with identifiers;
  unresolved exits remain visible and prioritized, never silently closed.
- Only a separately supplied chain-attested `runSniperPaperCycle` input
  with fastlane gating can use Money's actual **paper** fill simulator.
  Public pair price is never substituted for a canonical route quote.
- Tick acknowledges one result only after injected journal append succeeds.
  It records `PAPER_RECORDED`, `NO_TRADE`, missing proofs and unknown
  exit status distinctly. The monitor never constructs a signer, RPC
  broadcaster, Coffer lease, order or financial wallet settlement.
- Bounded `runSniperReadOnlyLoop` requires explicit host invocation and
  supplied pacing/signal; importing the module does not start any worker.

### .09 — Durable local crash/retry receipt
- `sniper-live-paper-journal.ts` appends one fsynced, 0600, SHA-256
  envelope per unique (work ID, observation time) in a **pre-existing,
  owner-only 0700 absolute directory** on a separately authorized host.
- Hash of the full record, filename ID binding, owner check, symlink and
  permissions rejection, identical replay vs conflicting replay,
  recovery-time checksum validation and bounded enumeration.
- This is an activity/outcome *receipt* store, not the canonical
  `money_shark_sniper_intel_archive`, Money accounting, or Shadow memory.
  The latter's reviewed migration and RLS still need commissioning.
- Multi-process concurrency, network filesystem lease and off-host backup
  require further integration tests before continuous production use.
  Do not claim recovered records = verified onchain fills.

### .10 — Release acceptance
- Targeted tests cover public GET contracts, mismatched chain/pair,
  finite quotes, owner-only record/replay, tamper detection, exit-first
  priority, aged entries, invalid provider evidence, paper-only Money
  handoff and abortable finite repeat cycles.
- Existing SHARK CI expanded with these tests. Exact-head CI and broader
  Launch Gate / Money R13B / iPhone QA must be read *after* the final push,
  never inferred from parent green runs.
- The private Railway Telegram staging worker is a disabled hold process,
  **not** the sniper runtime. Do not repurpose it without separate review.
- The connected Phantom owner account remains observation-only,
  `trading_enabled=false`, no unattended signing authority.
- Do not create/modify paid provider accounts, deploy a scheduler, change
  login/auth, fund the wallet, sign, broadcast, place trades or merge without
  separate explicit approval.

## Operational acceptance still required
1. Reconcile #1457 → #1497 → this PR with #1455 filter fixes,
   #1496 owner-wallet read-only work and Shadow migrations; exact-head CI.
2. Owner-approved standalone **read-only** host, private persistent volume,
   bounded cost/CPU/network policy, single-writer lease, restart and kill drills.
3. Attest an actual event and mint/program/slot from canonical chain, record
   provider→server receipt and detection gaps, p50/p95/p99 by launch regime.
4. Observe real public original pairs and separately verify fresh buy/sell
   route return with fee/slippage/tip, paper failures and unknown exits.
5. Prospective paper study across every observed/rejected mint, not only
   selected winners; capture 15M/1H/4H/24H/3D/7D results without lookahead.
6. Replay after owner-host kill/restart, verify no lost/duplicated receipts.
   Restore canonical SHARK/Shadow archive in isolated DB first.
7. Private iPhone acceptance: clear PUBLIC RESEARCH vs CHAIN VERIFIED vs
   PAPER vs ONCHAIN distinction, last receipt, stale feed, missed events,
   queue backlog, open simulated inventory and unresolved exits.
8. Separately review real isolated Coffer custodian, signer lease,
   budget/fee caps, route risk, kill switch and actual settlement; no
   live trading should follow merely from a successful paper loop.
