# SHARK-ALPHA.FABRIC.05–.08 — live Pump research pipeline (source-only)

**October 17, 2026 PDT. Stacked on draft [#1376](https://github.com/bookieandco/crispy-waddle/pull/1376).** No merge, deployment, running always-on host, real Telegram alert, signing, funds, auto-sniping, trading, paid RPC, proprietary scraping, Supabase writes, or training on Telegram content is asserted or authorized.

## .05 — native Solana Pump logsSubscribe transport

Code: `packages/shark-intelligence-core/src/meme-trader/pump-live-session.ts`.
- One authorized `wss://` Solana-compatible RPC endpoint, using the canonical `buildPumpLogsSubscribeRequest` Pump program mention filter; subscription ACK must match the JSON-RPC id.
- Ignore other subscriptions, malformed or >256 KB messages, wrong ACKs. Serialize notifications to preserve initial reserve baseline before subsequent `TradeEvent`.
- Socket disconnections, subscribe errors and processor failures trigger bounded exponential reconnect and an explicit gap receipt. `stop()` revokes timers and closes socket. The research `canTrade` flag remains false.
- Uses injected socket factory and schedule for deterministic tests; a Node 22+ native-WebSocket factory is available, but importing does not open network access. A persistent trusted host must explicitly call `start`; no Vercel request/job/CI runner can be treated as a stable always-on watcher.
- Reference: https://solana.com/docs/rpc/websocket/logssubscribe (the mentions filter only supports one address).

## .06 — canonical bounded replay, never 100% coverage

Code: `pump-rpc-replay.ts`.
- Bounded (`limit<=64`) public `getSignaturesForAddress(PUMP_PROGRAM_ID)` followed by `getTransaction` receipts and original `meta.logMessages`; no `getProgramAccounts` scans, private keys or vendor bypass.
- Every transaction identity/slot and successful meta/log availability must match the summary. Missing/null transactions remain explicit `missing`; the result always declares `PARTIAL_UNVERIFIED`, `retrospectiveOnly:true` and `canAlertAsEarly:false`.
- `createPumpLiveOwnerHost().recoverOffline` may run **only after the websocket is stopped** to avoid racing live transaction state. Recovered data enters the engine in `RETROSPECTIVE` mode with zero early-push delivery.
- This is not comprehensive backfill: a 64-signature window can truncate history, same-slot ordering is not independently authenticated, the provider may omit archival transactions, and false negatives are possible. Production host must preserve independent audit/restore evidence before claiming replay coverage.

## .07 — native live research, WATCHKEEPER-sourced evidence

Code: `pump-live-research.ts`.
- Uses the existing Pump Anchor decoder, canonical PDA validation and lifecycle tracker, without copying any vendor sniper bot.
- Dedups `signature:eventId`, blocks backwards slots, quarantines malformed evidence and does not invent a CreateEvent/initial curve baseline for trade-only notifications. Bounds in-memory token tracker and seen-event history.
- Creator, cluster, sniper-density and rug evidence must come from an explicitly supplied **bounded** risk provider: mint-specific, observed before candidate availability, <=30 seconds old with evidence IDs. Missing risk evidence stays `REVIEW`, never `WATCH`. A suspicious token is `RISK_BLOCKED`.
- Optional quote research must come from independently supplied canonical WATCHKEEPER indicative forward/reverse receipts; even if fresh, this is `PAPER_REVIEW_ONLY` without sellability proof.
- 90%/98% bonding-curve thresholds, curve-complete/pool-unverified, and risk-block signals reuse .01–.04 `pump-graduation-alert.ts`. The raw Pump migration event does not certify a PoolSwap pool. No finding promotes `canTrade`/signing/trade execution.
- Original event time versus availability and processing time is retained; stale and retrospective events never become early owner alerts.
- Nothing here empirically establishes profitable alpha or an entry/exit fill.

## .08 — owner-only message adapter and local durable claims

Code: `apps/jhadina-web/src/lib/shark/pump-owner-telegram-sender.ts`, `pump-local-alert-claims.ts`, `pump-live-owner-host.ts`.
- A self-hosted **server-only** composition connects the WebSocket engine, guarded RPC replay, risk/quote provider and optional Telegram private sender.
- Telegram sends only sanitized public mint/curve research messages, to a configured numeric `TELEGRAM_ALLOWED_USER_ID`. No `getUpdates`, personal inbox read, chat content persistence or Telegram-derived AI/ML.
- Default OFF. Explicit `ownerCommissioned=true` plus `telegram.explicitlyEnabled=true`, `ownerAuthenticated=true`, valid bot credentials, and a `claim` implementation are all required.
- `createPumpLocalAlertClaims(existingPrivateDirectory)` gives a simple atomic local SHA-256 filename receipt in an existing 0700 directory. Claim-before-send ensures at most one send *attempt* per key on that host even if network outcome is uncertain. It does not prove delivery or off-host backups and must not use ephemeral Vercel/CI storage.
- The bot token must be provided on the trusted owner host only, never in ChatGPT, GitHub, repo files, job logs or Google Drive. A 200 response isn't enough: the Bot API must also return `ok:true`.
- Never equate an injected `ownerAuthenticated` Boolean in an uncommissioned test fixture with real owner identity evidence; bind it to the verified owner configuration after a private canary and revocation drill.

## Acceptance — prove before merging/commissioning

```sh
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.shark.json
pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/shark/pump-owner-telegram-sender.test.ts src/lib/shark/pump-local-alert-claims.test.ts
```

1. Exact-head GitHub SHARK, Launch Gate and Spatial CI; no head drift.
2. No log subscriptions, Telegram messages or paid service created by CI.
3. Trusted owner-operated persistent Node 22+ host, provider terms, rate limits and independent source check verified; no Vercel serverless runtime pretending to hold an always-on socket.
4. Live authenticated `logsSubscribe` ACK, true fresh CreateEvent, TradeEvent crossing, stale-event suppression, forced disconnect and monitored gap receipt observed in signed/redacted canary.
5. A bounded manual replay is incomplete by design; prove missing-case censor and owner push suppression.
6. Independently verify owner chat ID, disabled-by-default flag, filesystem claim persistence/recovery and uncertain-send duplicate prevention with a private canary.
7. Swlc Supabase restoration and reviewed schema/RLS is **separately blocked** (#1110/#1257). This branch never touches it.

## Next code target
`SHARK-ALPHA.FABRIC.09–.12`: provenance-preserving X/Reddit/Bluesky and existing Social Core provider adapters, live source reliability/independence metrics, cross-source early mention vs on-chain causality, and the owner-facing Alpha Board.

**No wallet integration, no live trade authority, no returns or profit claims.**
