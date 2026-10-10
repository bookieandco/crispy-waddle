# MONEY-FINISH.01–.16 — execution-ready handoff
**Date:** 2026-10-08  
**Canonical product:** `bookieandco/crispy-waddle` / `@jhadina/money-core`  
**Feature inventory:** `docs/architecture/MONEY-UNIFIED-FOREX-STOCKS-FINISH-2026-10-08.md` (`MONEY-UNIFIED.01–.37`).  
**Purpose:** Turn the complete current-chat and historical money/FX/options handoff into a realistic set of non-duplicative code PRs and live-operational certification gates. This document is **the execution order**, not a claim that any items below have passed.

## Product definition and done states
- One first-party owner-facing **Money Core** with cross-asset research, broker/feed provenance, stocks, forex, options, metals, SHARK crypto, prediction intelligence, macro calendar, strategies, paper ledger and Jhadina advisory review. `NO_TRADE` is a valid outcome.
- **Jhadina** interprets evidence and challenges trades; deterministic **Money/Action Core** enforces independent funds, risk, broker/venue and permit policy. Autonomous model search and **paper-only** strategies permitted after verification; model output never authorizes live trading.
- Preserve Coffer / Purse **settled real cash, realized profits, bank/Phantom USD vs SOL/USDC** truth. Paper, shadow, forecasts, historical counterfactual and marketing examples never become actual funds.
- Phone is a signed owner dashboard/control interface, **not** an assumption of 24/7 compute. Unattended observation requires authorized durable worker, proper access, restart recovery and alerts. Connected ChatGPT Google Drive is **not** worker OAuth.
- Certification is **per lane and per evidence type**. An umbrella `FINAL` state cannot hide unavailable option chains, private source recovery, broker onboarding or deficient sample sizes. If markets/data/compute are missing, mark **BLOCKED_PROVIDER / BLOCKED_STORAGE / BLOCKED_COMMISSIONING / RESEARCH_ONLY**, not “passed.”
- Out of scope unless separately explicitly authorized: live orders, crypto signing, bank transfers, deposits, funding approval, paid compute provisioning, brokerage trade-key enrollment, automatic tax filing, third-party browser extension trading, Telegram/Discord automated trade execution. Broker connectivity in this sequence is read-only or sandbox/paper.

## Audit findings — don't rebuild
Confirmed on `main` at audit SHA `b534a29f20f1a48aa69f28c03f73e14fd1323561`:
- FX: `fx-market-reality.ts`, `fx-intelligence-fusion.ts`, `finnhub-forex-market-data.ts`, `fx-chart-vision-research.ts`; point-in-time quotes, decimal FX crosses, macro, carry/rollover, regimes, research forecasts and Brier scoring.
- Stocks: `stock-market-reality.ts`, `stock-intelligence-fusion.ts`, `alpaca-stock-market-data.ts`, `stock-paper-baseline-strategy.ts` with deterministic SMA example. Signal decisions are not live permits.
- Options: `options-contracts.ts` has CALL/PUT LONG/SHORT semantics, payoff/breakeven/premium/risk; **not** proof of option-chain data, Greeks, GEX, charm/vanna, multi-leg fills or settlement.
- Metals: `metals-market-reality.ts`, `metals-intelligence-fusion.ts` for XAU/XAG/XPT/XPD spot/futures reference/research.
- Paper/research and authority: `market-data-source-contracts.ts`, `market-provenance-contracts.ts`, `institutional-flow-contracts.ts`, `paper-execution-engine.ts`, `paper-learning-loop.ts`, `autonomous-strategy-learning.ts`, `behavioral-risk-contracts.ts`, `strategy-budget-contracts.ts`, `risk-analysis-engine.ts`, `money-prod-software-certification.ts`, PostgreSQL paper stores.
- Existing `packages/money-core/package.json` scripts include `type-check`, `test`, `test:integration`, `build`, `verify:prod-final`, and Shadow runpod CLI actions. **Do not count passing mocked/unit tests as running market-data ingestion.**
- Historical PR **#720 merged to main**, consolidating options, institutional flow and other research from #696–#701. PR **#1052** was merged into its parent branch, *not necessarily main*; verify exact files before promotion.
- As of 2026-10-08: **#1098 MARKET-IQ open**, **#1149 SHADOW-REPAIR draft open**, **#1148 SHADOW-GDRIVE draft open**, **#1162 PURSE integrity draft open**, **#1166 PURSE funding stacked on #1162**, **#1165 SHARK protected assessment draft open**. This plan PR **#1169** is documentation-only.

## Chat-by-chat and source scope locked into this plan
1. **Spike-bot.com:** minute-scale buy/sell UI, transparency requirements; proprietary accuracy numbers, OTC venue performance **unverified**. No copied trading bot or live broker integration.
2. **Six-macro-signal/quant + AI video:** macro regime gate, deterministic opportunity scan, Jhadina adversarial fundamental reasoning, independent Shadow output grading. Video thresholds, score blends **not calibrated**.
3. **Trading psychology/performance video:** pre-trade journal, rule deviations, setup/day/regime expectancy, reports, news and SEC/earnings research, options Greeks+aggregate portfolio delta. No diagnosis from loss history.
4. **Three options beginner/day-trading videos:** calls/puts, Greeks, strike/expiry, actual contract bid/ask, 5m opening-range break and retest, support/demand/reversal, target/stop. Example profits not track records.
5. **Options GEX/DeepGamma Sept 26 transcript:** put/call walls, 0DTE, volume/flow, uncertain dealer hedging, **gamma/charm/vanna**, research-only source inference and prospective testing.
6. **Forex institutional EA claims Sept 26:** 300 traders / named bank trades / pips / profits **vendor assertions**. Observed vs inferred typed provenance in `institutional-flow-contracts.ts`; no verified bank flow.
7. **Forecaster projection Sept 26:** historical three-month analogue search for FX/stocks/indexes, tiny-match caveats, overlapping-window/selection correction, confidence distributions not future certainty.
8. **Bull Bridge marketing video:** adaptive multi-strategy regime router worth testing; military-grade AI and 36%/200%/10x returns unverified.
9. **TradingKit/Claude and TradingView videos:** massive strategy generation, robust lockbox/forward incubation, Pine parity, drawdown+rolling-expectancy pause. Vendor integration or extension trade-permissions not trusted by default; 1.8x binary gross payout mathematical break-even 55.56% pre-cost, data/contract specific.
10. **Supplied GitHub donor catalog:** MIT `bennycode/trading-signals` indicators, MIT `spodzone/R-stock-signal` benchmark, AGPL `goldspanlabs/optopsy` research/license review, obsolete MIT `hayatoy/ml-forex-prediction` baseline only, unmaintained GPL `noootown/Forex-DQN` reference only, `newbie6661/falcon-trade` EA ideas only, MIT `fizahkhalid/discord-bot-forex-news-alerts` alert UX. Source, data, model and executable license terms are **separate** gates.
11. **MetalpriceAPI, OpenAccountants, Campfire:** metal reference/daily feed subject to rights/quota and timing; OpenAccountants provides tax guides (not books); Campfire illustrates GL/double-entry/month close, **not trading ledger authority**. No assumed connected accounts.

## Coding PR series: each PR must include tests + verified exact-head run

### P0: unblock truth and independent state
**MONEY-FINISH.01 — Original-state inventory and merge ledger.**  
Inputs: main SHA + PRs #720, #1098, #1148, #1149, #1162, #1165, #1166. Classify every feature `MAIN | OPEN_PR | MISSING | EXTERNAL_BLOCKED`, old source branch, code file, tests, schema, semantic overlaps, blockers and ordering; inspect exact-head failing checks, not just GitHub “checks pending”.  
Implementation: `docs/architecture/MONEY-COMPONENT-TRUTH-MATRIX.json`, `docs/architecture/MONEY-MERGE-ORDER-2026-10-08.md` with machine-checked code-path assertions.  
**Exit:** no duplicate option/FX/paper subsystem; serialized forward-port and CI plan; reasoned BLOCKED markers for SWLC/RunPod.

**MONEY-FINISH.02 — Durable paper store and invalid-grade recovery.**  
Inputs: #1149, #1148, 9-table Shadow ledger recovery/migrations, existing `postgres-paper-*store.ts`, Supabase/Network Volume evidence, read-only RunPod metadata. **Never restart/start billable Pod or assume original ledger recoverable.**  
Implementation: single storage eligibility/health record; owner scoped immutable paper event IDs, idempotent apply, grade quarantine; PostgreSQL when independently available, verified local persistent fallback for research/paper when available, encrypted backup and isolated restore receipts; persist source hash/record counts and privacy boundaries.  
**Exit:** real isolated source→restore readback OR explicit `ORIGINAL_DATA_UNAVAILABLE` fresh-start accounting; old grades invalid, not rewritten; restart/dedup tests.

**MONEY-FINISH.03 — Authority and accounting invariants (P0).**  
Inputs: Action Core, `market-connector-contracts.ts`, `paper-execution-engine.ts`, #1162 integrity fixes, #1166 stacked funding.  
Implementation: enforce observed/research-only→paper-only→owner-authorized live **one-way gated contracts**, separate credentials/funds/ledgers, no inferred deposits, no replayed real provider events, unknown order reconcile-before-retry, lock changes to risk mandate.  
**Exit:** red-team tests of AI/tool/webhook/strategy memory/trade alert inability to sign, send, fund, raise limits, execute, or turn paper holdings into spendable capital.

**MONEY-FINISH.04 — Provider-license and evidence gate (P0).**  
Inputs: external donor and feed matrix.  
Implementation: version+SHA pin, code vs data rights and fee tier, publication/observed/received/available timestamps, source confidence, point-in-time embargo, historical adjustments, contract/site hashes and secrets policy.  
**Exit:** stale/future/cross-venue/synthetic/unauthorized source rejected; Optopsy AGPL and OpenAccountants guide rights marked blocked until reviewed.

### P1: get canonical **real** read-only market data
**.05 — Stocks + FX core data.**  
Reuse Alpaca + Finnhub, FX macro, carry/session, exact decimal pips; corporate actions and DST; add second rights-cleared source only where actually usable, with provider disagreements and NO_TRADE threshold. No “Finnhub = broker”.  
**Exit:** reproducible actual timestamped bars/FX quotes through persisted observations, historical/lookahead/holiday and unavailable-provider tests.

**.06 — Metals, macro calendar and news research.**  
Read-only MetalpriceAPI reference (or properly licensed alternative) with XAU/XAG/XPT/XPD units, base currency, quotas, staleness; point-in-time official CPI/central bank/earnings calendar and alert provenance.  
**Exit:** metal reference !== executable spot bid/ask; news revision latency and release-blackout cases verified.

**.07 — Options chain & execution market reality.**  
Real licensed stock/index-option quote-chain or explicit `BLOCKED_OPTIONS_FEED`; contract identity, OCC adjustment, multiplier, Greeks field timestamps, expiry/cash vs physical/early exercise, spread/size/OI/quotes/greeks, underlier link, event time.  
**Exit:** 0DTE closing time, stale quotes, crossed spread, illiquid strikes, exercise/pin and fee edge cases fail closed; no naked short options auto-simulated.

### P2: rebuild **strategies**, not trading execution layers
**.08 — Streaming indicators + deterministic signal league.**  
Pinned MIT `trading-signals` integration with batch-vs-streaming parity; past-only `R-stock-signal` ranking; test SMA baseline, RSI/MACD, ATR, VWAP, ORB/retest, supply/demand, mean reversion, FX trend/carry/event/volatility, metals/USD/real-yield factors; preserve NO_TRADE.  
**Exit:** time-frozen feature/materialization, no incomplete candle bias, exact deterministic fixture and venue fee cost replay.

**.09 — Options math and positioning research.**  
Use `options-contracts.ts` rather than replace. Price/volatility scenarios with model limitations, delta/gamma/theta/vega/rho, preexpiry vs expiry P&L, portfolio net Delta; dealer GEX/charm/vanna and wall/flow maps **only** with proper option chain/trade data and signed dealer inventory uncertainty. Optopsy research isolated until license clearance.  
**Exit:** independent Greeks fixtures, symmetry/multiplier/unit tests, long-call/put paper quote fills, explicit `DEALER_POSITION_UNKNOWN` when dealer-side position data absent.

**.10 — Machine-learning and historical-analogue challengers.**  
Modern supervised FX classification/probability models (not ancient Python 2 dependency), DQN only isolated offline research, anchored walk-forward with purged gaps and train-only feature scaling, historical-analogue FX/equity path retrieval and baseline comparison.  
**Exit:** report Brier/log-loss, calibration, costs, drift, random-walk/no-position benchmarks, confidence interval and missing evidence. Never infer a forecast advantage from an attractive demonstration.

**.11 — Strategy Factory experiment ledger and lockbox.**  
Immutable candidate/config hash, trial family, ALL attempted variants, failure and exclusion reasons, dataset entitlement and time, trial budget, held-out *single-use* lockbox, nested/walk-forward and multiplicity correction. Optional untrusted TradingKit/Pine tooling sandboxed read-only, independent native vs Pine backtest parity.  
**Exit:** repeated peek at holdout, retroactive mutation, missing rejects or predecision hidden data causes explicit failure.

**.12 — Regime selection + Jhadina Make-It-Make-Sense.**  
Merge/forward-port MARKET-IQ #1098 after review and passing exact-head CI; macro gate, multi-asset correlation, spread/volatility, economics/earnings, institutional observed-vs-inferred and MIMS coherence-vs-truth advisory. Rank eligible frozen strategy candidates against deterministic baseline; uncertainty-aware sizing bounded by fixed per-lane paper caps; no uncalibrated “half-Kelly” live.  
**Exit:** AI contribution measured by ablation on independent held-out/forward paper evidence; no qualitative override of hard risk.

### P3: reliable runtime, profitable **truth not promises**
**.13 — Forward incubation, health governor and outcome learner.**  
Lifecycle `RESEARCH → FROZEN → INCUBATING → PAPER_ELIGIBLE → PAUSED/RETIRED`. Prospective evaluation only after freeze; rolling net expectancy, drawdown bands, profit factor, data/venue health, event and regime shift, sample-size suppression, model drift; deterministic pause and human-reviewed resume. Integrate #1149 Shadow point-in-time 15m/1h/4h/24h/3d/7d maturity, no present-day repricing historical events.  
**Exit:** multiple independent real timestamped paper cycles incl. losers, blocked outcomes and permanent grade lineage, idempotent restart/PAUSED receipt; model learns only from valid labels.

**.14 — Persistent paper operations, strategy league and journal.**  
Existing `paper-execution-engine.ts` and paper stores for virtual bid/ask fills, slippage/fees/carry and portfolio exposure; daily/weekly performance cards, FOMO/rule-override indicators from recorded behavior, actual vs expected edge, option- and FX-specific reports. Scheduled worker on approved host; alerts via approved channel and a human-readable audit queue.  
**Exit:** uninterrupted multi-cycle paper run, service restarts, failover/no-duplicate fills, independent receipt hash and daily loss/drawdown kill switch; human-readable provenance.

### P4: owner UI and financial reconciliation
**.15 — Money Desk + Coffer/Purse accounting.**  
One mobile-friendly Money dashboard for STOCK/FOREX/OPTION/METALS/CRYPTO/SHARK/PREDICTION/Sports research. Candidate history, event calendar, Greeks/GEX ambiguity flags, source staleness, strategy health, NO_TRADE, manual approval queues and device access controls. Reconcile #1162 then #1166 and the canonical Cash/fees/settlement/realized P&L ledger; build balanced GL *posting proposals* inspired by Campfire; optional vendor integrations read-only.  
**Exit:** real and paper balances never mix; currency/asset double-count prevention, owner paydays remain non-executing until separately approved, no private secrets in phone payloads. UI works with provider blocked states.

### P5: evidence-based final acceptance
**.16 — `MONEY-FINISH.FINAL` certification and handoff.**  
Fresh exact-main/head CI and all `@jhadina/money-core` `type-check`, `test`, `test:integration` (when provisioned) and `verify:prod-final`. Reproducible market snapshots, signed/hashed versioned strategy data, actual provider read-only canary, restored datastore proof, paper-worker multi-cycle evidence, costs, no future leak and live-negative authority tests.  
**Exit:** issue independent receipt with statuses `SOURCE_CLEAN | DATA_PROVEN | STORE_RESTORED | PAPER_COMMISIONED | PREDICTIVE_EDGE_VALIDATED | UI_READY | LIVE_DISABLED_OR_SEPARATELY_COMMISSIONED`. If any missing, **DO NOT** issue blanket FINAL; list exact next repair command/secret-holder action. Different assets can be `RESEARCH_ONLY` or `DATA_BLOCKED` without obscuring truth. Separate future explicit owner consent required for any live broker, DEX, transfers, forex venue, options, betting or prediction-market execution.

## PR dependency graph / recommended implementation slices
```
#1169 documentation + main truth
  └── FINISH.01–.04 audit/authority/store/license P0
        ├── #1149 Shadow grade repair ── #1148 encrypted recovery
        ├── #1162 Purse finance P0 ── #1166 Purse funding/paper
        └── #1098 Market-IQ exact-head review
  └── FINISH.05–.07 actual data adapters
        └── FINISH.08–.12 quant/model/strategy/AI
              └── FINISH.13–.14 paper incubation + durable runtime
                    └── FINISH.15 dashboard/accounting
                          └── FINISH.16 evidence-backed FINAL
```
- **PR 1 (FINISH.01–.04)** clean basis and security invariants; mandatory first.
- **PR 2 (FINISH.05–.07)** feeds, vendor entitlement and scenario fixtures.
- **PR 3 (FINISH.08–.10)** deterministic technicals, options and FX ML.
- **PR 4 (FINISH.11–.12)** experiment factory, Market-IQ and MIMS.
- **PR 5 (FINISH.13–.14)** prospective paper Soak + drift/governor/Shadow.
- **PR 6 (FINISH.15–.16)** owner UI, accounting reconciliation and final evidence.
Each code PR on main latest exact SHA with focused tests and integration negative-capability tests. Do not stack unreconciled PRs or merge documentation as proof of function.

## Hard gates / external blockers (track without stopping all independent work)
- **Supabase SWLC/PostgreSQL:** previously returned 57P03/unavailable; verify before applying migrations. Fallback research store only with tested durability/recovery, owner scope and lifecycle.
- **Shadow RunPod:** eight stopped Pods in prior read-only inventory, zero running, original Network Volume unverified. No automatic spend; mark original historical data unavailable until recovered.
- **Google Drive:** owner’s ChatGPT Drive connection != worker auth. Backups require actual machine OAuth/secret, encrypted snapshot, hash and isolated restore.
- **FX broker:** Finnhub is read-only market data. No real FX account or permitted broker endpoint proven.
- **Options/0DTE and order flow:** data licensing, historical point-in-time quote/chain and venue settlement. No imaginary high-frequency / dealer-sign inference.
- **Metals:** Reference midpoint daily data does not equal executable quote; quota/time resolution matters.
- **TradingKit/TradingView/TriggerTrade/Bull Bridge/Spike:** unverified performance and external tool safety. No browser-agent live trading shortcut, no copied account access.
- **Accounting integration:** Campfire not connected, OpenAccountants tax reference does not replace balance ledger.
- **Market-IQ/Purse/Shadow:** source branches unmerged, cannot use as main dependencies until reconciled.

## Always-on validation rule
**On each milestone, first check whether identical code exists**, then reuse/repair it. New modules require direct unit test, at least one failure/authority/point-in-time test, explicit asset scope, data-rights/provenance gate, seed and SHA, typecheck, evidence receipt and PR link. Unavailable source or venue is not an invitation to make up historical outcomes. A profitable backtest is a research result, not permission to trade or proof that a model has learned.

## Exact package commands for a real checkout
```sh
pnpm install --frozen-lockfile
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core test
pnpm --filter @jhadina/money-core verify:prod-final
# Only when disposable/restricted integration DB and credentials exist:
pnpm --filter @jhadina/money-core test:integration
```

## Handoff status at document creation
- This `MONEY-FINISH.01–.16` is an **implementation plan**, not implemented code.
- Main audit SHA `b534a29f20f1a48aa69f28c03f73e14fd1323561`; source features vary by main and open PR. Refresh head before work.
- PR #1169 at `375cb0372cdefed68157f96099ec63941432c751` when this new document was planned, draft documentation only. Do not mistake prior green `Spatial Conformance` workflow for full Money test validation.
- Start next coding task at **`MONEY-FINISH.01 → .04`**. No new separate Money execution repo, paid API account or unapproved live trade in this handoff.
