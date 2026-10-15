# MEME-WALLET.13–.16 — bounded daily paper research and recovery
October 14, 2026 · Stacked on PR #1287 → #1284 → #1281 and prior draft Phantom stack.

## This code does not commission a live sniper

The user's owner-created Solana wallet is still unverified as a signer and not in source code. No wallet sessions, signing keys, deposit instructions, Jupiter swap requests, RPC balance calls, Coffer accounts, Supabase keys, or production orders were introduced. **Zero live trading and funding authority.**

### .13 Canonical SHARK ingestion contract
- `apps/jhadina-web/src/lib/shark/meme-wallet-daily-paper-bridge.ts` consumes typed results from existing `runMemeAssessmentCycle`, which already records a canonical persisted SHARK assessment and governed Money ingress.
- Requires persisted assessment and ingress status `INSERTED`/`REPLAY`, matching assessment identity and token, explicit intelligence-only authority and no financial execution / wallet-signing grant.
- Calls `mapSharkAssessmentToMemePaper` for each candidate with separately sourced, timestamped price and safety receipts. Duplicate cases and future evidence fail closed; missing safety evidence makes the candidate blocked, **not safe**.
- Produces a deterministic digest-bound source batch. The digest proves encoding agreement, **not a cryptographically authenticated producer**. The scheduled host and source-provider authentication remain to be commissioned.

### .14 Research-only daily scheduler
- New `migrations/036_runpod_meme_wallet_paper_scheduler.sql`: private append-only `runpod_meme_wallet_paper_cycle_claims`, UNIQUE `wallet_id + utc_day` and `runpod_meme_wallet_paper_halts`; DB triggers reject UPDATE/DELETE, public grants revoked.
- `claimMemeWalletPaperCycle` performs an atomic insert-once claim in the database before processing. A claimed day cannot be automatically retried after a crash; operator must diagnose incomplete day. This intentionally runs **at most one bounded batch per wallet per UTC day**, not millisecond sniping.
- `haltMemeWalletPaper` appends a permanent paper stop latch. Every cycle checks the latch before and after claiming. There is no bot API to remove or reactivate it.
- New role admission `assertMemePaperSchedulerDbRole` enforces SELECT+INSERT only on the two scheduler tables as well as the two previously created paper journal tables, rejecting broad write privileges on any other public table.
- `runMemeWalletPaperDailyCycle` is an importable worker function requiring owner-paper commissioning inputs, a restricted DB and a bound source batch. It sequentially inserts only paper proposals. **No autonomous fills, exit orders, signs, broadcasts, swaps or live actions**. Code-level owner approval flags are *not* proof of a real owner mandate; an authenticated owner-bound host config remains a deployment prerequisite.

### .15 Restart-safe conservative exposure
- `recoverMemePaperDay` reconstructs daily paper spending and order counts from persisted append-only proposals, validates no-execution fields, reads the permanent kill switch and checks earlier-day unresolved admissions.
- Any open/filled/unknown/unsettled paper admission is an unresolved position; the next paper entry is blocked until a separately designed and certified paper exit accounting protocol exists.
- Full daily read fails if the 1000-record limit would truncate; unknown values are not inferred as zero.
- Failed/interrupted claimed days are not silently replayed. One cycle/day and fail-closed unresolved inventory are intentional safety constraints until concurrency and exit cost basis are verified.

### .16 Seven-day scorecard
- `scoreMemeWalletPaperSevenDay` reports day coverage, blocked candidates, simulated fills/failures/unknowns, recorded simulated cost, pending/open cases and unverified sources.
- Does **not** invent dollar profit, realized gains, win rate or drawdown from token-atomic output fields lacking independent mark-to-market and exit receipts. Those outputs stay `null` with explicit incomplete status even for seven synthetic days.
- Includes deterministic tests for the proposed cycle, one-per-day claims, runtime restart/replay failures, halts, input timing/digest, persistent state, missed days and no live authority.

## Actual prerequisites still required
1. Independently review/rebase/merge all stacked draft PRs against current `main`.
2. Independent DBA review and manual application of Postgres migrations **035 and 036** to a *private* research database, with dedicated non-superuser `SELECT`/`INSERT` grants ONLY for four paper tables. Tests use mocks; no real DB grants have been checked.
3. Owner-authenticated wallet identity registry, explicit paper-only approval and a protected owner-host schedule. The previous iPhone local watch address is not an authenticated backend wallet.
4. Deploy an actual approved SHARK assessment feed with on-chain liquidity/sellability, provider quote and provenance available-at receipts; verify completeness, replay and freshness on live data. The current worker accepts these via an injected trusted port and does not poll external providers.
5. Add independent simulated exit/valuation accounting and clear unresolved-paper positions before increasing frequency or making profitability claims.
6. Real unattended hosting and seven-day experiment must be observed with timestamped receipts before saying "running while the phone is off". **No unattended host/deployment was created here.**
7. Live signer, wallet spending, trading and owner funding remain separate future scope; existing `evaluateMemeWalletFutureCanary` stays BLOCKED.

### Exact-head verification
```sh
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core verify:meme-wallet
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/shark/meme-wallet-daily-paper-bridge.test.ts
```

Passing software CI is not external-host certification. No charges authorized.
