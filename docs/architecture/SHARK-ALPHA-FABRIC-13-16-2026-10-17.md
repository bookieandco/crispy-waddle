# SHARK-ALPHA.FABRIC.13–.16 — Source-only closeout handoff

Date: October 17, 2026 PDT. **Stacked on draft #1385 → #1382 → #1376**. This branch contains code, tests and owner acceptance UI. **No provider, host, finance account, Telegram bot, iPhone device, Supabase migration or trade execution was commissioned.** Do not merge child branches ahead of parents.

## .13: Explicit provider permission and one-read canary
- `packages/shark-intelligence-core/src/meme-trader/alpha-feed-commission.ts` gates Pump, Bluesky, X and Reddit independently on explicit owner opt-in, reviewed source-specific scope, evidence identifier, review time, bounded max calls per minute, and free/approved spend posture.
- Unapproved metered provider access fails closed; Reddit Ads `adsread` is NOT authority for Reddit community organic data. No X/Reddit direct read, OAuth, scraping or fee incurred.
- `apps/jhadina-web/src/lib/shark/alpha-feed-canary.ts` connects the existing bounded Bluesky public AppView adapter to these gates, producing a hashed source-only response receipt from one opt-in public read. No outbound request is issued by importing the function, opening a PR, running the tests or loading the Alpha Board.
- Even after a passing canary, the result is `CANARY_PASSED_SOURCE_ONLY` with `productionCommissioned=false`, `liveDeliveryVerified=false`, `budgetCharged=false`, `canTrade=false`. A provider body and SHA-256 receipt are not cryptographic provider attestations.

## .14: Honest denominator and missed-price-only-winner cohort
- `alpha-missed-winners.ts` evaluates *all observed eligible launch rows*, not just promoted picks, with exact mint dedup, prospective vs retrospective distinction, SHARK selected/abstained state, 24–30h clock consistency, same-pool censoring, explicit missing-outcome denominator and counts of missed 2× **price-only** marks.
- It does NOT claim it observed the complete set of Solana/Pump launches. `allLaunchCoverage=UNKNOWN_INCOMPLETE`; unobserved launches remain unknown, not zeros. `missedWinnerRate` is undefined without eligible marked-up tokens.
- 2× *provider price marks* are not executable fills, safe token status, reliable exits or provable strategy gains. No existing seven-day experiment state was modified.

## .15: Prospective frozen comparative baselines
- `alpha-prospective-baselines.ts` requires the same exact observed-mint universe and a prior frozen selection/abstention for each of `SHARK_FUSED`, `CHAIN_ONLY`, and `MOMENTUM_ONLY`.
- Duplicate submissions, missing decisions, future signals, retrospective edits and decisions after price marks are rejected. Counts are explicitly separate for highlighted, abstained, matched, missing or censored price-only marks.
- No inferred P&L, fees, slippage, executable fill price, sellability, statistical superiority or calibration claims are made. Price mark proportions cannot become execution authority.

## .16: iPhone Alpha Board and manual acceptance
- `apps/jhadina-web/src/lib/shark/alpha-board-view.ts` safely allows an optional *aggregate-only* `evaluation` section in existing local `SHARK_ALPHA_BOARD_V1` files (compatible with old board files). The UI now shows observed cohort, missed 2× price-only marks, censored cases and paired-baseline denominators.
- No raw social post text, user handles, Telegram histories, credentials or wallet details are exported to the board.
- `alpha-iphone-acceptance-panel.tsx` adds a touch-friendly, browser-session-only checklist on the existing `/shark/alpha` page for portrait, touch, local JSON, invalid-file handling, privacy, no-trade controls, accessible warnings and feed-gap honesty.
- All eight manual boxes checked is still labeled `LOCAL_SELF_CHECK_NOT_CERTIFIED`. Only a **real owner iPhone, signed/redacted acceptance evidence and separately commissioned host/provider** can establish a true rollout. This code does not run or simulate that acceptance.

## Bounded code and safety verification
```sh
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test
pnpm --filter @jhadina/jhadina-web exec tsc --noEmit -p tsconfig.shark.json
pnpm --filter @jhadina/jhadina-web exec vitest run \
  src/lib/shark/alpha-feed-canary.test.ts \
  src/lib/shark/alpha-board-evaluation.test.ts \
  src/lib/shark/alpha-iphone-acceptance.test.ts
```
Exact-head SHARK CI includes these new tests; broader UX/Launch/Spatial/deployment CI must also pass before merge.

## Remaining external acceptance, intentionally not invented
1. Reconcile/merge parent #1376, #1382, #1385 in sequence after their own checks; then this PR after rebase and checks.
2. Recover Swlc Supabase with operator-backed restore/RLS proof (#1110/#1257), no replacement database or unauthorized persistence.
3. Obtain actual approved X/Reddit access if chosen, verify free Bluesky and Solana public provider terms/rate limits and exact live source timestamps.
4. Commission owner-controlled persistent Node host with durable off-host recovery and independently witnessed Pump WebSocket outage/replay acceptance.
5. On a real iPhone Safari, load the Alpha Board, inspect missing coverage, test rejected file, confirm no trade controls; privately validate a notification and revoke it.
6. Audit the whole observed-launch cohort, explicit missing launches/late provider marks, prospective baseline snapshots, and risk-block false positives. Do not advertise unmeasured returns.

**Next target:** `SHARK-ALPHA.FABRIC.17–.20`: source-level commissioning under a real approved host, full market-outcome censoring/exit feasibility research, calibration and prospective comparison evidence, plus owner canary. No trades or expenses without separate authorization.
