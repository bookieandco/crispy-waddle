# MONEY-UNIFIED.01–.24 — Stocks, FX, Options, Metals and Cross-Asset Intelligence
**Audit/handoff — 2026-10-08. Source baseline:** `main` @ `b534a29f20f1a48aa69f28c03f73e14fd1323561`.

## Mandate and truth standard
Finish **one** Jhadina Money Core, not independent FX, stock, options, metals, SHARK and “AI signal bot” execution systems. Money Core alone has financial authority. Jhadina/Market-IQ/SHARK/Prediction/Sports/ML can contribute evidence and research but never execution permits. `NO_TRADE` is a successful defensible output.

This document **plans** the next code work. Existing source contracts, old “FINAL” titles, a successful fixture test, or this PR do not certify live operation, broker connectivity, original Shadow data recovery, or investment performance. Previous conversational proposal `MONEY-HYBRID.01–.31` is an **unimplemented candidate backlog**, NOT an already completed run. This sequence is its reconciled successor, while retaining the unique proposals (Spike-style UI, deterministic+AI analysis, psychology, options and indicators).

**Authorization:** Paper/research first. Funding or account linking does not itself enable trading. Never place live orders, withdraw, move USD/Phantom funds, sign transactions, start paid infrastructure, or change mandates during this work. Existing live-capable Money code remains separately gated by instrument, provider entitlement, independent risk, policy, owner approval/mandate, short-lived single-use permit, receipt and reconciliation. Don't bypass those gates with a “test” adapter.

## Confirmed current repo foundations: reuse, don't rewrite
- `packages/money-core/src/fx-market-reality.ts`, `fx-intelligence-fusion.ts`: currencies/pairs, decimal pip arithmetic, direct and derived crosses, session overlap, carry/rollover, base/quote macro, point-in-time forecasts, Brier/calibration. Finnhub GET-only feed: `finnhub-forex-market-data.ts`. `fx-chart-vision-research.ts` is unverified reference vision, NOT a price feed.
- `stock-market-reality.ts`, `stock-paper-baseline-strategy.ts` (20/50 SMA, `PAPER_SIGNAL_ONLY`), Alpaca stock data; stock intelligence and market snapshots.
- `options-contracts.ts` models CALL/PUT, LONG/SHORT, premium and expiration payoff, intrinsic/extrinsic, break-even and simple risk. Does **not** prove option chains, actual Greeks, fills, early assignment, multi-leg handling, or venue liquidity.
- `metals-market-reality.ts`, `metals-intelligence-fusion.ts`: XAU/XAG/XPT/XPD spot/futures identity, quote, unit, provenance, macro/risk and research-only forecasting.
- `market-data-source-contracts.ts`, `market-provenance-contracts.ts`, instrument master, portfolio/construction, paper executor/ledger/learning, risk, funding, Action Core, Money Feed, SHARK shadow contracts already exist. Preserve immutable evidence, availableAt cutoffs, decimal units, and separately labelled PAPER vs REAL financial state.
- `docs/architecture/MONEY-PROD-FINAL-production-acceptance.md` explicitly states software completion is not external commissioning. `MONEY-COMMISSION.2-MONEY-FEED.1-owner-control-feed.md` has per-lane budgets and committed-vs-suggested safeguards. Preserve both.
- Closed/merged consolidation #720 supersedes closed #696–#701 source PRs. #1052 Shadow learning was merged into its parent branch, **not proof of a running recovered ledger**.

## Current dependencies/blocks and sequencing
- Shared `MARKET-IQ.FINAL` PR #1098 is **OPEN/unmerged** at audit, head `8df96b1d...`: domain bridges and cross-domain hypothesis restrictions. Reconcile exact current head + CI before forward-port or merge; do not duplicate its framework.
- SHADOW-REPAIR #1149 and SHADOW-GDRIVE #1148 are **OPEN/draft**. Read-only RunPod inventory reports eight stopped Shadow-named Pods, zero running; original durable data-bearing store not recovered; SWLC/Supabase had PostgreSQL 57P03. No historic grade may be silently invented or repaired using today's spot.
- PURSE-AUTO #1166 is **OPEN/draft**, stacked upon integrity/payday #1162; no proof of actual funding/withdrawals. Never attribute simulated P&L to spendable profit or use the funding UI to authorize a trade.
- Existing main combined status included two unrelated failed Vercel director checks; CI acceptance for this exact new head must be assessed independently. Do not pronounce main clean from a single green job.
- Google Drive connected to ChatGPT does not mean worker OAuth, durable transactional storage, or a verified encrypted original-ledger backup. Private Drive can archive **encrypted** evidence/receipts after separate real restore proof; no unapproved infrastructure purchases.

## External donor assessments — licensing and data are separate
| Donor | Useful role | Disposition |
| --- | --- | --- |
| `bennycode/trading-signals` | MIT TypeScript streaming RSI/MACD/ATR/VWAP/etc. | **ADOPT** standalone indicator package only, pinned SHA/version, check parity/streaming resets; do not adopt its broker/Telegram executor. |
| `spodzone/R-stock-signal` | MIT simple multi-window BB %B/RSI/gradient score | **REIMPLEMENT AS BENCHMARK**, normalize each historical decision from past-only data; ranking is not evidence of edge. |
| `goldspanlabs/optopsy` | AGPL-3.0-or-later Python options strategy/backtest research | **QUARANTINE** until legal/license and precise input-data validation; isolated research prototype only, no unreviewed embedding. |
| `hayatoy/ml-forex-prediction` | MIT EUR/USD price-prediction example | **RESEARCH ONLY**; README targets Python 2.7, 2008–16 data and last-5% test: obsolete setup. Reimplement a modern reproducible baseline, don't import its outdated runtime. |
| `noootown/Forex-DQN` | GPL-3.0 deep-Q agent example | **REFERENCE ONLY**; self-described NOT MAINTAINED. No live RL or copying policy without license/security/regime/drift review. |
| `newbie6661/falcon-trade` | EA/indicator concepts, XAUUSD and trailing/risk concepts | **REFERENCE ONLY**; README advertises strategies and some WIP, no independently established profitability/security/redistribution rights. Never wire EA to MetaTrader trade submission. |
| `fizahkhalid/discord-bot-forex-news-alerts` | MIT filters, timezone and pre-event reminders | **REFERENCE FOR ALERT UX**; do not treat a scraped economic calendar as official fact. Source-of-truth official releases/authorized data feed needed. |
| `openaccountants/openaccountants` | Cited, dated, jurisdiction-scoped tax reference Guides | **OPTIONAL RESEARCH ONLY**; **not** a double-entry accountant, journal, broker, or payout executor. Code AGPL-3.0-only; Guides separate OA Guide License and commercial restrictions. Respect vetted vs draft, year/jurisdiction/caveats; no automatic tax filing. |
| `metalpriceapi.com` | HTTPS read-only FX/XAU/XAG/XPT/XPD midpoint/reference rates and history | **CONDITIONAL ADAPTER**. Free: daily delayed, 100 calls/month, evaluation/personal use; paid intervals/usage/redistribution controlled by provider terms. Do not mistake midpoint for executable bid/ask; no one-minute strategy from daily data. Prefer `X-API-KEY` header, secret redaction, quota headers, observed/available timestamps, reciprocal/base handling and metal troy-ounce units. |
| Spike-bot.com | fast BUY/SELL UI and expiration selection | **UI reference only**; marketing win-rate and proprietary six-engine claims unverified; avoid broker-coupled OTC 60s trading. |

## Detailed implementation sequence — ordered, independently reviewable PRs

### P0 — Truth, authority, durability
**MONEY-UNIFIED.01 — Exact-head repo/PR reconciliation.** At a fresh main SHA, inspect #1098, #1148, #1149, #1162, #1166, historical MONEY and SHARK branches; produce file/feature overlap map, deduped statuses, CI blockers and merge dependency graph. Never assume PR code already exists on main. **Acceptance:** machine-readable inventory with `present_on_main | open_pr | missing | blocked` per capability and exact SHA receipts.

**.02 — Dependency, license, market-data-rights registry.** Pin upstream SHA and intended import boundary. Attach MIT/GPL/AGPL/Guide-license notes and **separate** upstream data/feed/commercial/resale rights evaluation; flag UNKNOWN as not admitted. **Acceptance:** licenses/usage gates and test fixtures, no source copied without clearance.

**.03 — Canonical market-data contracts.** Extend existing `market-data-source`, `market-provenance` and instrument adapters; include provider, venue, asset/contract ID, base/quote, unit, currency, bid/ask vs midpoint, observed/available/received/effective timestamps, rights, adjustment, hash and stale/duplicate/conflict states. **Acceptance:** cross-venue disagreement/future leak/unresolved symbols/crossed quotes/units reject; no fabricated observations.

**.04 — Durable state and restore truth.** Reconcile Money paper ledger, source event idempotency, independent storage, immutable fills and positions, cash/settlement, owner scoping/RLS. Preserve any historic Shadow records; mark broken grades invalid without rewriting originals. Supabase recovery 57P03 stays explicit BLOCKED; use verified authorized persistent local storage where available; no claim Drive = database. **Acceptance:** restart, duplicate delivery, isolated restore, hash, ledger reconciliation receipts.

**.05 — Governance proof.** Assert `research != order`, paper/live completely separate capabilities and stores, unknown order reconciles before retry, forced NO_TRADE on bad/late data, risk veto/kill-switch and approval boundaries. **Acceptance:** negative tests proving no market feed, model, Telegram, EA, Jhadina output or Shadow memory can call live executor, move funds or change mandate.

### P1 — Reliable feeds, calendars and adapters
**.06 — Stock source gate.** Normalize Alpaca and any rights-cleared stock/ETF bars, corporate actions, session calendars, universe survivorship and quote quality. **Acceptance:** historical splits/dividends/halts and stale/partial-feed tests.

**.07 — FX source gate.** Reuse `fx-market-reality` + Finnhub GET; add a second independent legally usable FX quote source only after licensing and mapping, cross-rate bid/ask direction, pips/lot conventions, spreads/carry, DST session, rollover and economic-release blackout. **Acceptance:** EUR/USD, USD/JPY, EUR/JPY triangular and delayed/event examples with exact decimals and availableAt.

**.08 — MetalpriceAPI adapter.** Add **read-only** server-side connector to `metals-market-reality` and FX reference rates: latest/historical, quota and failure classification, XAU/XAG/XPT/XPD in troy oz, base/quote inversion, header-key secrecy, stale/outage and provider drift; record midpoint/reference NOT executable spread. **Acceptance:** canned fixtures + denied-quota/zero/stale/reciprocal-unit tests, no API key in URL/logs/client.

**.09 — Macro/news calendar intake.** Admit timestamped CPI/central-bank/earnings/holiday releases from official or contractually approved sources; schedule alerts using user's timezone and each venue timezone; store publication/revision time and embargo. Discord scraper concepts may inspire UI only. **Acceptance:** surprise/revision latency, late-release and pre-event NO_TRADE tests.

**.10 — Options quote chain intake.** Normalize OCC-like contract IDs, multiplier, expiry+timezone, style, settlement, bid/ask, size/OI/volume/IV/Greeks, corporate actions and assignment/exercise flags. Evaluate data vendor capability/cost before subscription. **Acceptance:** bid/ask crossing, zero-volume, 0DTE cutoff, illiquidity, multiplier/adjusted contracts, stale and settlement tests.

**.11 — Cross-asset observation bridge.** Reuse #1098 only after reconciled, SHARK-Money ingress, prediction and sports domain bridges, metals/FX dependencies; calibration remains domain-local. **Acceptance:** no SHARK price/social inference becomes stock/FX/metal truth or execution authority; no cross-domain transfer without target-domain validation.

### P2 — Strategy and AI research
**.12 — Indicator package and parity.** Use MIT `trading-signals` streaming indicators through an adapter to existing StockBars and FX quotes; compare batch vs streaming and a separate reference implementation; allow incomplete candle replace but freeze closed-bar decisions. **Acceptance:** reproducible RSI, MACD, VWAP, ATR, BB %B and session reset fixture parity.

**.13 — Deterministic stock strategies.** Implement *candidate* 5m opening-range break/retest, reclaim reversal, supply-demand context, volume/trend filters, and existing SMA baseline; make entry/exit/invalidation/no-trade explicit. Incorporate past-only R-stock score as an experimental challenger, never a magical win rate. **Acceptance:** exact replay, future leak/selection bias and fill-timing tests with negative controls.

**.14 — FX baseline league.** Multi-horizon trend, mean reversion, rate differential/carry, momentum+volatility, event regimes, spread and rollover; start with transparent naïve/random-walk/zero-position baselines. **Acceptance:** net-of-cost walk-forward vs baselines across sessions, regimes and currency pairs; never backtest against non-tradable OTC quotations.

**.15 — FX machine-learning sandbox.** Reproduce documented features and supervised probability forecasts in modern Python, immutable train/test splits with purging/embargo and training-only feature scaling. Offline RL/DQN is separate experimental champion/challenger candidate with transaction costs, action safety and no live execution. **Acceptance:** out-of-sample Brier/log loss, directional benchmarks, drift, confidence intervals and regret; require improvement over deterministic baseline, not cherry-picked equity curve.

**.16 — Options model and contract selector.** Extend `options-contracts.ts` with proper mark, Black-Scholes-style scenarios when assumptions fit, delta/gamma/theta/vega/rho, volatility-surface diagnostics, breakeven at expiry vs P&L before expiry, spread/liquidity; preserve early-assignment and pin-risk handling. Use Optopsy only after AGPL disposition. **Acceptance:** independent pricing fixtures, max-loss including exercise/assignment paths, realistic long CALL/PUT paper candidate ranking, no naked shorts automated.

**.17 — Metals regime/fair-value research.** Reuse XAU/XAG/XPT/XPD models; study DXY, real yields, central-bank changes, commodity basis and spot/futures carry separately, provider-available market fields only. **Acceptance:** XAUUSD reference vs executable FX conversion differences, unit/purity and market-vs-reference labeling.

**.18 — Jhadina analytical review and MIMS.** Deterministic macro gate+scanner feed an **advisory** qualitative layer for filings, events, options exposure and counter-thesis. Persist model ID/version, prompt, source availability, structured citations, red flags, bull/bear, falsifiable triggers. Make It Make Sense judges coherence separately from truth; LLM quality weights learned only from valid forward samples. **Acceptance:** ablation against quant-only and AI-only/no-AI; AI cannot change risk veto or directly create an order.

### P3 — Paper learning, owner operations and certification
**.19 — Paper ledger and risk realism.** Use existing Money-owned paper order/fill/position/cash/commission ledger; lot-size, notional, venue hours, borrow, margin boundaries and transaction costs. Options simulation must use executable bid/ask and timestamped chains, with quote-based conservative slippage; no synthetic guaranteed stop. **Acceptance:** consistent replay/P&L, drawdown, portfolio exposure, partial fills, UNKNOWN/retry and cash constraints.

**.20 — Scientific validation harness.** Walk-forward/nested OOS, blocked/purged temporal splits, Monte Carlo/block bootstrap, negative controls, multiple-comparison corrections, sensitivity, drift and liquidity-shock replays; compare gross vs net returns and no-trade baseline. **Acceptance:** exact hash/seed, audit of data availability and complete reporting including failures/no-trades.

**.21 — Shadow repair and learning admission.** Reconcile #1149 and #1148, recover existing actual original records or clearly label fresh-start; 15m, 1h, 4h, 24h, 3d, 7d grading ONLY at actual mature time from matching chain/token/pair/venue/contract. Quarantine bad historical outcomes; do not project lessons until source reliability and exact restore/readback pass. **Acceptance:** duplicate/out-of-order/old-grade quarantine and original-snapshot isolated restore tests, separate runtime health vs profitability.

**.22 — Journal and performance coach.** Automatic structured pre-trade entry/stop/target/thesis, post-trade report card, FOMO/revenge *behavioral indicators* (not psychiatric diagnoses), risk-rule adherence, performance by setup/session/weekday/regime, win/loss expectancy, missed/avoided trades, and model drift. **Acceptance:** reproducible daily/weekly summary, significance/low-sample caveats, owner-visible provenance and no inferred personal psychological diagnosis from P&L.

**.23 — Accounting / Purse / tax boundary.** Reconcile immutable provider fill→cash→position→realized P&L→fees→reserves→owner-payday *proposal*, never label shadow profit as withdrawable or count same cash twice; preserve #1162 P0 integrity fixes and #1166 dependency. Add tax-reference lookup through OpenAccountants only if jurisdiction/year, licensing, accuracy and review status are explicit; never substitute tax guide for canonical ledger or file taxes automatically. **Acceptance:** exact money/invariants, settled-real vs paper books, manual approval for any real movement, no fabricated deposits.

**.24 — Final operator readiness and certification.** One mobile-first landscape-friendly Money dashboard; stocks/FX/options/metals/shark tabs powered by shared data, no parallel orders; exposure, alerts, evidence, audit queue, paper league and actionable NO_TRADE. Unattended schedules only on already authorized durable worker; mobile phone is operator/control, not continuous worker. Stage receipts for provider read-only canaries, restarted real persistence, genuine option-chain samples, exact-head CI, rollback/kill-switch, three+ watchdog windows and independent paper results. **Acceptance:** `SOFTWARE_VERIFIED`, `DATA_VERIFIED`, `PAPER_OPERATION_VERIFIED`, `FINANCIAL_PROVIDER_BLOCKED` remain separate flags; FINAL only if actually evidenced. No self-promotion to live.

## Suggested review PR grouping
- **PR A (.01–.05):** repo truth / license / data contracts / durability / authority.
- **PR B (.06–.11):** stock/FX/metals/options feeds and calendar, no paid subscriptions provisioned.
- **PR C (.12–.18):** signal strategies / supervised ML / isolated RL / Jhadina review.
- **PR D (.19–.24):** Money paper ledger, true Shadow outcomes, journal, Purse reconciliation, operator certification.
Each PR must show exact-head test results, provenance and a **negative capability test** that its additions cannot execute live trades.

## Final acceptance evidence (not optional)
1. CI typecheck/test/build at exact commit SHA; distinct status for pre-existing blocked jobs.
2. Provider license/entitlement, upstream timestamps, independent provider snapshots and observed availableAt integrity.
3. Existing production-relevant ledger restored to an isolated runtime; source-to-restore checks and immutable record reconciliation. If original missing, label **new ledger** and do not claim historical learning.
4. Demonstrated scheduled paper worker across multiple healthy cycles; no orders on live endpoints, wallets or cash accounts.
5. At least one *genuine* supervised/paper FX and stocks strategy comparison, and options only when actual quote-chain data exist, with forward/out-of-sample attribution including losses and abstentions.
6. Per-asset-class quantified coverage gaps and cost/subscription gates; independently documented all P0 blockers.
7. Owner approval and provider commissioning are separate future projects; no automatic live deployment, no capital transfer, no tax filing.

## Primary audit evidence
- Repo/PRs: `bookieandco/crispy-waddle`, #720, #1098 (open), #1148 (draft), #1149 (draft), #1052 (merged into parent), #1162/#1166 (Purse draft).
- Canonical repo docs: `MONEY-FOREX-01-fx-reality-core.md`, `MONEY-FOREX-02-fx-intelligence-fusion.md`, `MONEY-METALS-01-02-precious-metals.md`, `MONEY-PROD-FINAL-production-acceptance.md`, `MONEY-COMMISSION.2-MONEY-FEED.1-owner-control-feed.md`.
- Connected private Google Drive note: `SHADOW-REPAIR P0–P2 and Google Drive Recovery — Build Plan` confirms missing live worker/restore/grades.
- Upstreams: https://github.com/bennycode/trading-signals ; https://github.com/spodzone/R-stock-signal ; https://github.com/goldspanlabs/optopsy ; https://github.com/hayatoy/ml-forex-prediction ; https://github.com/noootown/Forex-DQN ; https://github.com/newbie6661/falcon-trade ; https://github.com/fizahkhalid/discord-bot-forex-news-alerts ; https://github.com/openaccountants/openaccountants ; https://metalpriceapi.com/documentation ; https://metalpriceapi.com/terms .
