# SHARK-SNIPER.OPERATE.21–.24 — post-network timing repair
Date: 2026-10-23 (PDT).
Base: #1503 (commission .16–.20), stacked on #1501, #1499, #1497, #1457.
No production changes or live trading authority.

## Audit result and fix
In the inherited `runSniperLivePaperTick`, `input.now` was sampled before
`await readPublicPair(...)`. An authentic provider response will usually
carry `receivedAt > input.now`. The previous check would throw
`SNIPER_PAPER_PAIR_OR_RECEIPT_PROVENANCE_INVALID` for that perfectly valid
response. It happened to pass tests where the mock response time exactly
matched the tick's pre-network timestamp.

- Added optional per-step `deps.now()` which is called after awaited
  provider work. The explicitly commissioned host now supplies its actual
  clock, while old hermetic tests retain deterministic `input.now`.
- Clock regressions, unknown times and future-to-processing-clock data are
  rejected. Real after-network public observations can be journaled as
  public research, but cannot become an executable quote.
- If a risk/quote snapshot was assembled before a provider response and its
  time no longer matches the resulting decision cutoff, record
  `NO_TRADE: PAPER_SNAPSHOT_STALE_AFTER_SOURCE_READ` rather than fabricating
  a paper fill. Canonical snapshots must be collected anew with compatible
  event/route freshness to resume paper execution.
- Preserves exit-first scheduling and durable missed-launch entries. No
  Phantom signing, wallet settlement, paid provider or price-driven fill
  introduced. No code self-activates a worker on import.
- Timestamp equivalence is checked as milliseconds, not via unequal ISO
  string spellings (`Z` vs `.000Z`).

## Verified infrastructure as of this stage
- Parent #1503 was 8/8 GitHub checks green, including Jhadina Launch Gate.
- Vercel preview `dpl_5UJkNKN1r2TrVKKyquGLbAECGXFz` was READY
  on exact parent commit `300a962c`, protected with Vercel SSO.
- An attempt to read protected-preview runtime logs through the connector
  returned 403 (no runtime claim from that error). Build logs and deployment
  state remain available.
- Connected Supabase still lacks `money_shark_sniper_intel_archive` and
  canonical `money_shark_shadow_*` tables. No schema writes performed.
- Telegram's staging service is not a commissioned SHARK sniper worker.
- Owner iPhone Face ID navigation and canary live-provider requests have
  NOT been independently verified by the owner or by this audit.

## Minimum safe acceptance before unattended research
1. Exact-head SHARK, Money, UX, Spatial, Jhadina Launch Gate checks for child;
   preserve parent review and keep draft until changes are reconciled.
2. Protected preview rebuilt at the **child** SHA. Owner must check sign-in,
   /shark/sniper, disabled source canaries, back navigation and second-user
   access denial, with no password/protection bypass.
3. Review live Helius delivery rights/costs; obtain prospective provider and
   onchain corroborated mint events. 600ms remains a goal, not a measured SLA.
4. On owner-approved separate persistent host, demonstrate genuine public
   response arriving **after** the initial batch cutoff, journaled without
   fabricated paper fills. Report retries, rate limits, ingress p50/p95/p99.
5. Stage and review migrations/RLS for canonical Shadow learning and sniper
   archive in an isolated DB. A local JSON receipt directory is not the
   permanent intelligence ledger.
6. Kill/restart the real single-writer host, reconcile orphan lease, hashes,
   inventory and unresolved exits. Unit tests are not a deployed kill test.
7. Any Coffer funding, Solana transaction signing, Telegram auth, or real
   order submission requires another explicit separate approval.

Important: a protected preview is not a live market feed or automated worker.
Read-only preview work must not trigger account purchases or production changes.
