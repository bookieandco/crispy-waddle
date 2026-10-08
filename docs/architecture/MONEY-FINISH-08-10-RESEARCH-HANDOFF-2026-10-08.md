# MONEY-FINISH.08–.10 — deterministic candidate league, options Greek scenarios and FX challengers

**Project:** `bookieandco/crispy-waddle`, `packages/money-core`.  
**Stack order:** `main` ← #1170 P0 ← #1171 read-only feeds ← this .08–.10 PR.  
**Status:** source/testing work only; this document is not a claim of operational market-data, model profitability or permissions to trade.

## .08 — Source-gated indicator/candidate league

Module: `src/money-finish-signal-league.ts`, reusing `stock-paper-baseline-strategy.ts`, `money-finish-feed-admission.ts`, `stock-market-reality.ts`, `fx-market-reality.ts`. Implements explicitly specified research-only RSI(14), ATR(14), SMA20/50, EMA12/26/MACD9, Bollinger(20,2σ), volume-weighted 20-bar typical price for equity bars, previous-20 closed-candle high/low, three independent candidate indicators: trend confirmation, Bollinger reversion, prior-20 breakout. **Not** real fill logic; no orders or data purchases. FX has no presumed centralized volume; 20-bar VWAP is `null` for FX. Additional `money-finish-stock-rank-orb.ts` implements a true **five-minute closed-candle 15-minute opening range, subsequent breakout and subsequent retest** research candidate, with source and session evidence. It requires a separately verified trading session calendar and is not a fill/execution engine. It also computes 15/30/90-day %B/RSI/slope **R-stock-inspired**, past-only bounded non-predictive ranking. This is not the original R package or validated forecast; the MIT upstream code was not copied. No Martingale, Kelly bet or win-rate promises.

Entrypoints accept only closed time-ordered, source-pinned, nonduplicated, previously admitted observations. Stock normalizer demands equality with admitted evidence identifiers; FX requires independent verified session and spread evidence. The input contract is research-side; a session string alone is not a venue operating calendar. For a real FX replay, use the Finnhub raw candle adapter and a separate independently licensed bid/ask/session source to meet research-to-paper promotion gates. No use of `bennycode/trading-signals` or `R-stock-signal` copied upstream: this milestone implements original small deterministic baseline primitives while donor license/version admission remains unresolved. The full past-only R rank/streaming dependency parity work remains optional after real data and vendor licensing.

## .09 — Greeks / GEX risk diagnostics, **not** dealer predictions

Module: `src/money-finish-options-risk.ts`, consuming only `MoneyOptionsChain` from `.07`. Black–Scholes–Merton analytic European premium/Delta/Gamma/Vega/Theta/Rho and model vanna, plus a **one-day calendar-passage delta stress** labelled `charmPerCalendarDay` (not annual continuous charm). American-style options receive explicit `EUROPEAN_PROXY_FOR_AMERICAN_OPTION` warning; it does not price early exercise or assignment. 0DTE reports sensitivity instability; unsupported settlements and expired contracts fail closed. Spot and rate inputs must be independently supported with evidence IDs and cannot authorize execution.

Dealer GEX estimates are **conditionally bounded by supplied open interest** unless separately evidenced signed dealer positions exist. GEX is expressed in a consistent **USD delta-dollar change per 1% underlying move** convention: `gamma * spot² * 0.01 * multiplier * dealerContracts`. OI by itself cannot show buyer/seller or dealer inventory. The aggregate signed value is **null** if *any* leg's dealer-side position is unknown. No fake institutional flow/put wall, no manufactured 0DTE trading edge. Position evidence is still subject to provenance/entitlement review upstream. `optopsy` AGPL project was NOT imported; separate licensing review remains required. Existing expiry payoff calculator remains canonical.

## .10 — reproducible FX supervised candidate and analog research

Module: `src/money-finish-fx-challengers.ts`.

- A fixed four-feature logistic-regression **research baseline**: momentum, carry differential, realized volatility and spread. Input contract includes decision/feature/label available times, outcome evidence IDs, dataset hashes, paired mid prices. Validates chronology and label maturity. Uses training-only feature standardization, fixed deterministic optimizer, minimum 30 training/10 heldout samples, nonoverlapping case IDs and explicit purged/embargoed train-label/heldout boundary.
- Heldout Brier and log loss versus neutral 50% Brier and *training* class base-rate Brier. Status stays `NOT_CERTIFIED`. Study evidence hash records all cases; simple sample-size thresholds do **not** prove calibrated probabilities or robust predictive edge.
- Prospective forecast requires a new decision **after study evaluation cutoff**; model cannot reuse in-sample results to pretend forward success. Unproven features are rejected. No live/automatic allocation.
- Historical analogue lookup uses causal log-return prefixes, fixed lookback/horizon, historical windows with fully matured future outcomes before the *present* pattern, greedy non-overlapping selections, recorded distance, return quantiles and insufficient sample outcomes; no probability is labelled calibrated.

Do not launch DQN / reinforcement learning, label a 7-example analog as an 86% win rate, train from current OHLC values before bar close, rescale using heldout points, or reuse live verdicts from paper rows. News/sports/intelligence are research sources only and need separate domain validation.

## Exact tests and CI
Workflow `MONEY-FINISH.08-.10 Research Models` runs frozen pnpm install, type-check, targeted negative fixture tests, and entire Money Core unit regression. All CI results must be reported with exact commit SHA. Model *unit verification* is **not** a successful forward trading strategy. No historical licensed data was consumed for these fixture tests.

## External blockers, not silently completed
- #1170 and #1171 unmerged, this change must remain stacked and merge in order after exact-head checks.
- External real source entitlement, corporate actions, FX bid/ask and calendar coverage, options historical chain/Greeks/accurate OI freshness and signed dealer-position rights are not independently commissioned.
- Supabase/Shadow original restore and independently durable multi-cycle paper evaluation remain blocked by prior tasks. Do not create synthetic backfilled grades.
- No trained real market model, DQN, full strategy backtest with fees, Monte Carlo, Optopsy service, TradingView/TradingKit connector, or active broker funding/execution is claimed here.

## Next coding sequence
**`MONEY-FINISH.11 → .12`**: candidate registry, locked holdout, strategy incubation, parameter-trial accounting, Market-IQ review and Jhadina Make-It-Make-Sense research adviser. This must not bypass Money/Action Core hard trade approval. **`MONEY-FINISH.13 → .14`** commissions genuine forward paper evidence only after providers and durable store are verified.
