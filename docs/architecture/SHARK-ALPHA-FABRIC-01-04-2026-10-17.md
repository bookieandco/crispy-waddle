# SHARK-ALPHA.FABRIC.01–.04 + PRE-GRAD SIGNAL — October 17, 2026

Status: source changes proposed, not commissioned. **No wallet, order, fee, subscription, deployment, Supabase mutation, owner data access, execution authority or live Telegram monitoring.** No performance or sellability claim.

## .01: Canonical reconciliation
- Preserve existing `pump-anchor-log-decoder.ts`, `pump-decoded-event-stream.ts`, `migration-radar.ts`, actor assessment worker, Helius launch route, canonical Money, WATCHKEEPER and seven-day research.
- Draft Jhadina direct Social/Home PRs #1354/#1356 remain outside this patch. Draft Telegram owner client PR #1230/issue #1238 remains blocked; no personal Telegram data/AI integration.
- Swlc database #1110/#1257 is unavailable and may not be bypassed with a new storage layer. Existing pilot remains on its own data-only branch, untouched.

## .02: Evidence contract V2 / social clock repair
- `alpha-evidence-v2.ts`: mandatory occurredAt, receivedAt, availableAt, optional publishedAt and original upstream ID, source family, source handle, author, fingerprint and sorted evidence links.
- Strict time order, late-forward latency and no financial/copy authority. Provenance is provider-reported, NOT independently attested.
- `social-signal-bridge.ts` now requires receivedAt and availableAt for X/Reddit; never aliases post publication time into decision availability by default. Existing social extractor remains a research-only bridge.

## .03: Pump-qualified launch admission
- Legacy Helius implementation admitted arbitrary token transfers as new launches and fell back to current time for absent source timestamp.
- New `solana-launch-collector.ts` requires successful signed transaction, slot, timestamp, bounded programLogs, exactly one decoded Pump `CreateEvent` under the actual Pump invocation, canonical curve PDA, and matching optional Helius mint summary.
- The protected Next.js webhook rejects malformed proofs before privileged persistence. Existing secret and service-only data store are retained; errors fail closed. Token transfer-only webhooks and arbitrary mint strings no longer create a launch.
- **Important:** Helius enhanced transaction subscriptions do not necessarily include `programLogs`. If this field is absent, the endpoint now correctly accepts *zero* launches. Do not deploy this stricter parser assuming the prior webhook schema is compatible. Add an independently authenticated, bounded Solana logs collector in .05–.08 before commissioning this change. Provider payloads do not prove independent chain finality.

## .04: Adversarial tests and release hold
- V2 chronology: stale/forwarded posts, future publication, invalid receipt/availability, immutable no-trade fields.
- Social bridge: X/Reddit clock correctness, unsupported platforms, no authority.
- Pump: recognized CreateEvent and canonical curve, wrong invocation, failed transaction, absent sig/slot/timestamp, mint mismatch, stale/future sources, no fabricated liquidity.
- Existing read-only constraints remain: no signing, market manipulation, wallet funding, publishing, or live trading.

## Added: approaching bonding-curve owner alert
`pump-graduation-alert.ts` uses the preexisting canonical `PumpMigrationRadarCandidate`:

1. `NEAR_CURVE` when a fresh candidate crosses 90% calculated graduation progress.
2. `IMMINENT_CURVE` when fresh progress crosses 98%.
3. `CURVE_COMPLETE_POOL_UNVERIFIED` when the curve completes but PumpSwap pool verification has not been independently established.
4. `POOL_MIGRATION_OBSERVED` on a candidate with verified migration-pool evidence under existing radar semantics; NOT a sellability/entry guarantee.
5. `RISK_BLOCKED` overrides positive alerts on canonical defensive blocks.

The signal is transition-aware and stale/future/reordered events fail closed. It uses a stable mint+kind dedup key and optional bounded 30-second preexisting WATCHKEEPER *indicative* forward/reverse quotes. Even with paired quotes it labels only `PAPER_REVIEW_ONLY`, never executable profit. Format includes evidence gaps, risk blockers, observed/availability time and explicit no-trade warning. A delivery function accepts an injected sender ONLY with independent ownerAuthenticated=true; this is not a commissioned Telegram, iPhone, SMS or web push integration. Owner-only dispatch requires separately approved host/credentials, endpoint and authentication.

## Source reference: https://pump.fun/explore
The current public Explore view exposes **Movers**, **New**, **Custom pairs**, **Charities**, **Market cap**, **Oldest**, and **Last trade** filters. It can be a ranking/attention *comparison* after a genuine launch is known, but is not a complete or cryptographically attested new-launch feed. No unofficial Pump API or browser bypass is used here.

## Release acceptance
- Verify exact-head SHARK package TypeScript/Vitest and Jhadina Web type-check/bridge tests.
- Run root launch, SHARK money safety and spatial CI on the exact pull request head.
- Require authenticated production provider evidence and real owner notification test on a trusted device before claiming the alert delivers in real time.
- Supabase Swlc must independently pass restore/capacity/migration/RLS before durable writes.
- Safety: `canAuthorizeTrade=false`, `canAutoSnipe=false`, no live orders and no wallet privileges.
- If tests or production provider compatibility fail, leave PR draft and fail closed.

## Next ordered target
`SHARK-ALPHA.FABRIC.05–.08`: an authenticated, rate-limited Solana logs WebSocket consumer; event-index/replay dedup; valid Create/Trade/Complete/Migration lifecycle; WATCHKEEPER-backed risk and paired quotes; durable bounded owner notification with verified delivery and revocation, all research-only.
