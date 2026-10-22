# SHARK-INTEL.FUSION.01 — source audit, transcript hypotheses and trade-learning boundary
**Date:** 2026-10-22. **Branch:** build/shark-sniper-fastpath-rug-fingerprints-20261021 (PR #1457, draft). **Authority:** paper/research only; **no deployment/merge/trading authorization** from this file.

## Intent / architecture

Canonical data path (NO second memecoin engine):

1. Existing public/owner-permitted sources → signed/time-bounded event or evidence. Helius/DEX/public wallet, authorized Telegram-derived signal (research-only), social provenance.
2. Existing SHARK launch/mint/holder/creator/liquidity/migration/actor forensics → point-in-time deterministic **rug mechanism** classification + hard veto.
3. Existing SHARK→Money independent risk/liquidity/MIMS gate, landing quote comparison, realistic fee/slippage/latency/cancel/reverse-route paper simulation.
4. Existing Shadow decisions and delayed 15M/1H/4H/24H/3D/7D outcomes → independent attested lessons, preserving NO_TRADE counterfactuals and ungradable unknowns.
5. New `sniper-intel-fusion.ts` attaches read-only diagnostic source groups, evidence/hypotheses/quarantine, independent-lesson count, actual-onchain-vs-paper settlement distinction to `runSniperPaperCycle`. This object NEVER grants capital/signing/authorization or writes model memory.
6. Future separately approved durable admission/replay may feed independently validated lessons into subsequent SHARK decisions, Money strategy profiles and Purse evaluation. **That durable consumer is not yet commissioned.**

## Recovered YouTube transcript reference audit
These are user-supplied transcript text artifacts, not independently audited trading performance or live source streams. Sponsorship, extraordinary returns, named traders and asserted wallet reputations are **not verified facts**. Do not ingest their full text as live safety evidence or blindly import wallet lists.

| Input filename | Extracted research hypothesis | Independent measurement / veto test |
|---|---|---|
| `Pasted text(20260926-154825).txt` | New/final-stretch/migrated-stage screens; bundle concentration, fake volume, large leader exits, chart revival after rug | Stage-aware cohorts; common funder/wallet-ownership clustering; swap direction, LP supply and verifiable liquidity; independent failed-exit evidence |
| `Pasted text(20260926-154634).txt` | Copy-trade cascades, on-chain charts, cluster-synchronized sell pressure and exit timing | Group transfers by funding/control rather than a count of UI icons; time-stamped exits; sellable notional and actual route return |
| `Pasted text (2)(20261003-042150).txt` | Tracked-wallet labels, independent good/bad caller performance, rapid pump/dump cycles | Confirm wallet transaction signing/settlement and de-duplicate wallet cohorts; source independence; prospective point-in-time holdout |
| `Pasted text(20260926-154541).txt` | Sniping early versus latency, entry/exit risk, MEV and quoted fees | Actual observed-to-received/decision latency, priority/Jito fee cost; inclusion/landing, failure and adverse selection |
| `Pasted text(20260926-004056).txt` | Capital-size-dependent scalping, psychology/boredom guard, entry thresholds | Test position sizing / fee break-even on paper with prospective holdout; reject unverified profit guarantees |
| `Pasted text(20260926-004357).txt` | Broad beginner/interview strategies; narrative and market regime emphasis | Treat interview performance and headline returns as claims; evaluate actor, liquidity, downside, exits and regime against independent records |
| `Pasted text(20261003-041902).txt` and `Pasted text(20261003-040241).txt` | Volume-to-liquidity anomalies, group funding, narrative / attention / rug forensic playbook | Deduplicate duplicate transcript text; chain-confirm wallet clusters; compare market integrity against all launches, not handpicked winners |
| `Pasted text(20260926-005956).txt` | Pump.fun app UI / speed and watchlist ideas | UI feature research only; no proof that app notifications beat onchain event-to-decision latency |

Previous research corpus already folds many of these hypotheses in `packages/shark-intelligence-core/src/meme-trader/research-corpus.ts`; new fusion does **not** claim them as original algorithms or training examples.

## Existing PR lineage and non-duplication

- #1457 SHARK FASTPATH/Phantom draft: source for Helius launch intake, rug fingerprints, Money paper and Shadow/Purse evidence. Verified Phantom owner wallet account persisted in Supabase on 2026-10-22; **owner verification does not imply live trading**.
- #1455 filter pilot remains a different, draft code-only branch; preserve strict stage/fee validation, missed-winner studies, paper latency QA. Do not indiscriminately merge its broader stale branch.
- #1464 Telegram listener recover branch retains source-terms/privacy gates; cloud runtime and personal listener not certified. Telegram-derived messages are prompts for independent research, **never model-training data, trade permits or chain proofs**.
- #1489 Purse convergence is separately draft; financial execution and capital ledgers remain controlled by Money Core.
- #1185 SHARK/Shadow historical recovery repair remains draft; October 12 audit found wrong-time horizon grading, partial-write loss, unknown-return-to-zero grading, double-counted sample sizes and archive imports with no canonical consumer. New fusion handles temporal quarantine and distinct historical decision sample count for its projection ONLY, not those underlying schema/runtime defects.

## New source changes on #1457 (not yet certified)

- `apps/jhadina-web/src/lib/shark/sniper-intel-fusion.ts`: accepts existing SHARK risk decision, bounded observed evidence, canonical Shadow lessons, Money paper receipt, optional independently verified settlement. Produces immutable, never-executing diagnostic projection; tampered/future/duplicate observations quarantined.
- `apps/jhadina-web/src/lib/shark/sniper-paper-cycle.ts`: creates the fusion projection for BOTH NO_TRADE and PAPER_RECORDED without weakening the canonical hard rug veto.
- `packages/shark-intelligence-core/src/meme-trader/rug-protection.ts`: distinct defensive capability labels for Token-2022 permanent delegate, default frozen, unverified hook and excessive transfer fee; not claims of proven exploitation. Source must be independently witnessed before promoting flags.
- New focused tests; SHARK workflow includes fusion test. A historical Shadow lesson is not usable without a separate independently verified decision-relative observation receipt and cutoff-aware evidence match. A settlement must also match the canonical trade ID; matching token alone is insufficient. CI at exact head and full build must be observed, not presumed.

## Exact operational reality at report creation

Scoped read-only Jhadina Supabase queries: `jhadina_wallets` 1 row, wallet marked `ownership_verified=true`, `observation_enabled=true`, `trading_enabled=false`; `money_wallet_connections` corresponding `ACTIVE`. But `jhadina_trade_memory_records`, `jhadina_shark_market_events`, `jhadina_launch_outcome_observations`, `money_paper_execution_events` and `money_execution_permits` each have 0 rows. A verified wallet is not evidence of a running sniper/market collector or genuine trades. The October 12 audit's missing canonical `money_shark_shadow_*` tables have not been established as commissioned; runtime review needed.

No current real-trade receipts, live RPC listener latency distributions, wallet signer authority, independently attested P&L, merged code, current-head CI success, certified physical iPhone run, deployed learning consumer, or authorized live capital can be inferred. Do NOT label prior signed Phantom message as a trade.

## Acceptance / next sequence (no unintended live actions)

1. **Exact-head compile/tests:** SHARK CI, Money R13B, Launch Gate; verify TS module aliases and focused cases. Fix only confirmed regressions.
2. **Canonical source adapter:** Source adapter for independently validated Helius/DEX mint facts, Token-2022 parser receipts, owner-wallet signed/sent/confirmed swap receipts; never trust transcript claims or stale/future evidence. Log event timestamp, reception time, availability cutoff and actor group.
3. **Durable Shadow importer/ledger:** schema manifest, missing money_shark_shadow_* migrations, unique(assessment/decision/horizon/outcome), transaction/outbox recovery, bounded replay, no duplicate lessons, clean new history versus unrecovered original.
4. **Outcome quality:** missing price/baseline = ungraded; use contemporaneous token/pair orientation and decision-relative mark; unknown failure ≠ zero, no pretend sell. Cost/cash/PnL net of actual route fees, rent, Jito, priority, slippage, failed landings. Label paper P&L explicitly.
5. **Prospective study:** time-separated cohort of ALL qualifying and rejected launches, survival/delist/missed-winner biases; independent watch at 15M,1H,4H,24H,3D,7D; per-decision sample count and confidence intervals.
6. **Benchmark:** 0.6s discovery aspiration is not a measured SLA; capture event→provider→received→risk→quote→paper decision milliseconds (p50/p95/p99) and false veto/false approval with onchain audit.
7. **Private iPhone QA:** clear SHARK status showing LIVE PROVIDER OFF vs RESEARCH ACTIVE; owner wallet connected read-only, show last evidence age, quote verifications, simulation records, deny simulated/live conflation.
8. **Governed live pilot separately:** only after owner authorizes specific coffer, funded isolated execution wallet, strategy, test size and risk/fee/kill-switch limits; NO use of owner Phantom as unattended signing key.

Privacy: Uploaded YouTube transcript insights are reference hypotheses. Telegram owner/private message terms, identity and source consent govern any downstream use; do not use Telegram-derived text to train a model. Public wallet addresses are not personal identity proof. Do not expose seed words or private keys.
