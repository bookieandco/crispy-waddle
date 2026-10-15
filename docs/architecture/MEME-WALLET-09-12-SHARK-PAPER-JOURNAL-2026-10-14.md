# MEME-WALLET.09–.12 — Canonical SHARK paper bridge + durable Postgres journal
October 14, 2026. Draft stacked on PR #1284, owner-created watch wallet PR #1281 and parent Phantom PRs.

**Owner address is intentionally NOT committed. No live wallet sign-in, funding, transaction signing, swap, transfer, or autonomous trading was enabled.**

## .09 SHARK assessment adapter

`apps/jhadina-web/src/lib/shark/meme-wallet-paper-adapter.ts` maps the existing, persisted `MemeTradeAssessment` into the existing Money Core `MemeWalletCandidate` schema. SHARK's overall score, strategy fit, and generic risk band **never automatically set liquidityVerified, sellabilityVerified, tokenPermissionsSafe, or holderConcentrationSafe to true**.

Positive paper-only checks require one receipt for each type, bound to the exact Solana token address with source ID, source group, evidence ID, availableAt/observedAt and age constraints. Missing, duplicate, stale, wrong-token, or future observations yield `false`. The SHARK deterministic rug block and self-protection quarantine/escalation always dominate.

These receipt fields are passed by an *authorized* research data producer; their mere presence does **not** independently prove a live on-chain check. The adapter cannot be used as live-money authorization.

## .10 Application composition

`apps/jhadina-web/src/lib/shark/meme-wallet-paper-cycle.ts` composes an **already persisted** SHARK assessment with external chain-safety receipts and the owner-created wallet's public address, then submits the candidate to Money's guarded paper journal. It requires the persisted assessment ID to match. Wallet roles are distinct: personal owner, MCP agent and Coffer executor cannot be silently rebound.

No production route, polling scheduler or unattended hosted worker invokes this function yet. This work wires a callable research-only composition contract, **not** an always-on sniper.

## .11 Durable paper journal

`packages/money-core/migrations/035_runpod_meme_wallet_paper_journal.sql` defines two separate append-only Postgres tables:
- one proposal/decision per `wallet_id + candidate_case_id`;
- one simulated-settlement receipt per paper decision.

Constraints force `can_sign=false`, `can_execute=false`, `can_move_money=false`, paper-only authority and prevent SQL row updates/deletion. `createMemeWalletPostgresPaperJournal` uses parameterized SQL, serialized BigInt and exact replay rejection. A duplicate insert fails rather than silently producing another fill. The read interface refuses tampered authorities and cross-wallet/case mixes.

The dedicated database principal must be non-superuser, no schema/role/database creation, SELECT+INSERT on the two paper tables, and no mutation rights on any other public table. The role check is software only until run against the *actual* intended host and DB.

This schema is **not** Supabase `money_wallet_connections`, SHARK production trading, Coffer custody or actual-wallet P&L.

## .12 Tests and release gate

New tests cover:
- real SHARK assessment type shape, missing sellability evidence, risk veto, stale/misbound/duplicate receipts and lookahead;
- SQL parameter binding and readback, duplicate case/receipt resistance, tampered stored authorities and privileged DB principal rejection;
- pre-existing Money paper limits, paper-only owner review, unknown settlement freeze and zero live execution.

### Local verification after a reviewed checkout
```sh
pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/shark/meme-wallet-paper-adapter.test.ts
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/money-core verify:meme-wallet
pnpm --filter @jhadina/money-core type-check
```

## Still blocked before unattended *paper* hosting
1. Independently review/rebase/merge stacked draft PRs against current `main`, re-run exact-head CI.
2. Apply migration 035 only after a DBA reviews the intended isolated research database and grants a dedicated low-privilege role; no production DB mutation executed here.
3. Connect a genuinely authorized scheduled SHARK assessment feed and independent timestamped quote, verified chain safety, sellability and liquidity receipts. Inputs with missing evidence remain blocked.
4. Implement owner-bound read-only wallet registry on an authenticated backend, proof of wallet control and explicit paper-only policy approval. Browser local watch record is not commissioned as authenticated custody.
5. Harden paper budget state from durable journal, handle restarts and concurrent proposals, add cost/latency/exit calibration and unknown-settlement recovery. **No paper simulator is represented as live execution.**
6. Hold signing, funding and real trading disabled pending independent owner mandate, isolated signer, risk/reconciliation tests and a *separate* future commissioning effort.
