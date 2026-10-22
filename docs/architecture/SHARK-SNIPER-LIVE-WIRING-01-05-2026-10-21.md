# SHARK-SNIPER.LIVE-WIRING.01–.05 — guarded integration handoff
Date: 2026-10-21 (America/Los_Angeles). Branch: `build/shark-sniper-fastpath-rug-fingerprints-20261021`.
Release state: **DRAFT / CODE ONLY — not a commissioned live sniper**.

## Canonical lineage
Authorized Helius launch webhook / existing Pump decoded event path
→ SHARK point-in-time deterministic creator/rug/sellability gate
→ Money-only quote, fee, landing and slippage research
→ existing Money Core paper fill and portfolio engine
→ Shadow Learn and Purse typed reconciliation evidence.

Do not create a second wallet, trade authority, Telegram AI listener, training engine, or balance ledger.

## .01: incoming event-to-discovery
- Existing protected endpoint: `apps/jhadina-web/src/app/api/webhooks/helius/launches/route.ts` (requires configured Helius authorization header).
- Reuses `jhadina_shark_persist_launch_bundle` through `persistSharkLaunch()`.
- `sniper-live-ingress.ts` rejects arbitrary transfers as launch evidence, bounds batch sizes and parallel persistence, and passes canonical mint events to `SniperFastpathDiscoveryIntake`.
- Local in-process dedupe is provisional. Durable cross-worker uniqueness is the existing database upsert. Do not acknowledge success on persistence failure.
- `discoveryDelayMs` measures provider event timestamp → server receipt, while `localProcessingMs` measures local monotonic intake. Neither is a verified chain-event → filled-trade timing. Unix-seconds provider timestamps have coarse resolution.
- No always-on WebSocket, push-subscription provisioning, provider payment or live runtime deployment is claimed. The separate existing Pump decoded-runtime remains canonical for migration lifecycle events.

## .02: threat *kind*, not a yes/no oracle
- `assessSniperLiveRisk` consumes attested proof, reverse-path existence, liquidity, creator/cluster checks, holder independence, LP and token controls at an explicit cutoff.
- Reuses deterministic `evaluateRugProtection` and `evaluateRugSelfProtection` and emits the existing attack-mechanism fingerprints.
- Missing evidence, stale timestamps, unknown sellability and repeated bad creator outcomes BLOCK paper admission. A token can rug after a clean pre-entry observation.

## .03: execution economics, not MEV guarantees
- `compareSniperLandingRoutes` compares STANDARD_RPC and JITO_BUNDLE evidence only.
- Quotes must be current. The existing `assessSolanaSniperCostBudget` checks entry and exit base fees, compute-unit priority, tips, nonrecoverable rent, and extra adverse slippage against user limits.
- Requires sufficiently many independently chain-attested landed/failed observations; unknown landing or insufficient samples prevents selection. This is a retrospective research comparator, not Jito order submission.
- Do not double count venue fees and quoted price impact already included in route quotes. Do not assume bundle privacy or tip bidding guarantees fill or MEV safety.

## .04: actual Money paper simulator, not synthetic realized money
- `runSniperPaperRoundTrip` calls existing `simulatePaperFill` and `buildPaperPortfolio`, accepting only SOL_LAMPORTS accounting.
- Missing verified reverse route → OPEN_NO_SELL_ROUTE. Partial sells stay open with residual inventory. No exit fill means no fabricated realized return.
- `SniperPaperSoakLedger` is bounded, in-memory and idempotent. It is NOT a persistent 24/7 process. No historical market-only price point is upgraded into an executable fill.

## .05: Shadow Learn + Purse without financial mutation
- `runSniperPaperCycle` composes SHARK → route comparison → Money paper → `acceptSniperLiveWiringPaper`.
- Acceptance requires an admitted Purse paper opportunity, an existing Shadow decision, closed paper inventory and acceptable lane-cost research.
- Handoff uses `buildSniperShadowPurseHandoff`; all outputs retain `canExecute=false`, `canCreditPurse=false`, `canAuthorizeLive=false`. PAPER settlement never becomes ONCHAIN without a separate independent reconciliation receipt.
- No production API or database worker is currently calling the new paper coordinator on an always-on schedule. Wiring a durable authorized journal is subsequent operational commissioning, not implied by these pure functions.

## CI and release
Mandatory exact-head checks:
`pnpm --filter @jhadina/shark-intelligence-core type-check`
`pnpm --filter @jhadina/shark-intelligence-core test`
`pnpm --filter @jhadina/money-core verify:r13b`
`pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.shark.json`
`pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/shark/sniper-live-ingress.test.ts src/lib/shark/sniper-paper-cycle.test.ts`.

Required before **production commissioning**: external canonical-chain identity attestation for pushed events, wallet/actor historical cache refresh, fresh executable two-sided venue quotes (Pump curve math distinct from AMM/CLMM), provider fee/priority/tip sampling by regime, per-stage p50/p95 event-to-submission/landing and actual confirmed sellability, daily paper replay with failures/trapped exits, production RLS/idempotent journaling, owner-device acceptance and separate explicit financial authorization.

**Keep paid infrastructure, production deployment, wallet signing, live orders and spending disabled absent separate owner approval.**
