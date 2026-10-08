# MONEY-FINISH.05–.07 — Source-gated market data, economic calendar, options chains
**Baseline:** 2026-10-08, branch based on FINISH P0 PR #1170 at `005fbf07c3a12f3ff61d5117a93284a336377ccd`. This is a **stacked** code PR. P0 must pass its exact SHA review and land on main before forward merging this PR.

## .05 Stocks and FX
Reuse `alpaca-stock-market-data.ts`, `finnhub-forex-market-data.ts`, `stock-market-reality.ts`, `fx-market-reality.ts`, `money-finish-source-admission.ts`. New `money-finish-feed-admission.ts` admits bars/quotes for research only using a verified source/rights manifest, observed/available/received cutoffs, exact instrument/provider identity, time ordering, FX session evidence, quote freshness and **verified stock corporate-action coverage**. For splits/symbol changes/mergers in the data window, unadjusted bars are rejected. These contracts **do not grant Alpaca brokerage, live FX, or order permits**. A Finnhub FX candle without broker bid/ask is not an executable fill. Calendars/DST/session/rollover are external feeds/agreements; callers must not fabricate status.

## .06 Metals and official economic events
`money-metalpriceapi-reference.ts`: read-only HTTPS GET `https://api.metalpriceapi.com/v1/latest` or `/v1/YYYY-MM-DD`, **X-API-KEY header**, explicit provider rights/entitlement reference, USD base, XAU/XAG/XPT/XPD, reciprocal interpretation (USD per troy ounce when vendor rate is metal units per USD), quota headers, staleness, timestamp and reciprocal-conflict checks. Emit **NON_EXECUTABLE_MIDPOINT**, never a fake two-sided spot quote; don't feed directly to `buildMetalMarketSnapshot` as bid/ask. For newly retrieved historical dates, `availableAt=receivedAt`; true point-in-time history needs archived provider availability evidence. Plan-dependent delayed pricing is not a day-trading feed. **Docs:** https://metalpriceapi.com/documentation

`money-finish-event-calendar.ts`: explicit OFFICIAL or licensed-provider, timestamped economic/earnings/holiday event records; source publication and revision, event/asset tags, known calendar coverage; deterministic configurable blackout gate. `DATA_BLOCKED` on unverified coverage, `NO_TRADE` around releases. Does not fetch official CPI/Fed/news directly yet and has **no provider-integrated scheduling**.

## .07 Options quote-chain research
`money-finish-option-chain.ts`: typed vendor-neutral **OCC 21-character** stock option symbol/expiry/right/strike extraction, USD quote, explicit underlying, known contract multiplier and adjustment evidence, exercise/settlement and last-trade cutoffs, independent OI-as-of, ask/bid size and spread, IV and supplied Greeks validation, 0DTE physical settlement/pin-risk warning. Candidate classification is `PAPER_QUOTE_CANDIDATE` but all results **canExecute:false** and **canAuthorizeLive:false**. Research-only bridge to existing long call/put expiry payoff contract uses ask to model premium. No live contracts, quotes, pricing subscriptions, early assignment service, multi-leg orders or nonstandard adjusted execution authorized. Poor liquidity, stale data, 0DTE and adjusted contracts must not be promoted into automatic paper fills.

## Commissioning gates (explicitly unfinished)
- Provider market-data credentials, vendor agreement, entitlements for IEX/SIP, historical FX candles, usable options chains, macro release feeds and metalpriceAPI are **not** established merely by passing test fixtures.
- Paper runtime and recovered original Shadow store remain external gates (P0 #1170, Shadow #1149/#1148).
- Real end-to-end evidence requires independent **read-only HTTP sample receipts**, observed/source/received timestamps, rights, persistent readback, market sessions/DST and corporate-actions coverage, stable vendor identifiers and actual options chain examples including adjustment and 0DTE. No paid subscriptions enabled.
- No real broker orders, bank transfers, Phantom signing, portfolio allocation or capital movement.

## Test and acceptance
`MONEY-FINISH.05-.07 Market Feeds` GitHub CI runs frozen install, `@jhadina/money-core` typecheck, targeted source/authority/options and prior adapter tests, then the full Money Core unit regression. **CI green is software unit verification, not a commissioned provider**. Missing external coverage should surface as `DATA_BLOCKED` / `RESEARCH_ONLY` rather than synthetic market certainty.

## Next slice
`MONEY-FINISH.08–.10`: deterministic signals, indicators/stock and FX quant, Greeks and GEX option risk analysis, future-safe machine learning/analogues. First resolve/admit real legally usable data before certifying forward paper operation.
