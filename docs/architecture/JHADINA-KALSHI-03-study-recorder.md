# JHADINA-KALSHI.03 — 15-minute BTC prospective study recorder

**Status:** standalone research and persistence source ready for CI; **live continuous observation not yet commissioned**. No financial execution authority.

## System lineage
- Base: [JHADINA-KALSHI.02 PR #1240](https://github.com/bookieandco/crispy-waddle/pull/1240) — Kalshi-specific read-only book/reference reducer and fee-aware paper decision gate.
- This milestone: `src/kalshi-15m-study-recorder.ts` with unit tests and public Money Core export.
- Track commissioning: [issue #1241](https://github.com/bookieandco/crispy-waddle/issues/1241).

## Google Drive storage — verified as of 2026-10-13
The existing owner archive is:
- [KALSHI-BTC15M-PAPER-STUDY folder](https://drive.google.com/drive/folders/1rkvduEQq6qSf2kqI8J04tydj0USPp0SK)
- [CASE-001 and experiment protocol](https://docs.google.com/document/d/1DfIOgG-xSQ03NUk2EqTTxYsHmo7xhT8LqtYU1AocY6Q/edit)
- [96-window study ledger and scoring dashboard](https://docs.google.com/spreadsheets/d/1l-heS5CLxx-TyucPa6jQNIZt06axoWiqBB73M5utdPo/edit)

**IMPORTANT:** The 96 rows are *planned* and currently default to `NOT_OBSERVED`. Google Drive is **not** an authenticated WebSocket client, paper execution venue, durable WAL substitute, or 15-minute scheduler.

## Study source contracts
- `parseKalshi15mMarket`: requires canonical API market ticker, actual `close_time`, numeric `floor_strike`, rule text and greater-than strike type. Never parses screenshot slugs or assumes price.
- `fetchKalshi15mMarkets`: public GET to exact allowlisted Kalshi production/demo hosts, `?series_ticker=KXBTC15M&status=open&limit=200`, rejects paginated partial list rather than pretending it is exhaustive.
- `Kalshi15mStudySession`: accepts authenticated, read-only `orderbook_delta` and `cfbenchmarks_value` frames from a *future externally commissioned transport*. Emits one append-only record at each 600, 300 and 60 seconds before the exact close, within a 5-second admission window. Late forecasts are **not** backfilled; receipt ID is `marketTicker:horizonSeconds`.
- `baselineDirection`: uncalibrated *current-reference-above-strike* baseline, visibly separate from the independent predictive model and **never** offered as actionable expected value. Baseline is null if source freshness fails.
- `direction`: `ABSTAIN` until independently evidenced model, live book, verified fee, sufficient depth, and fee-adjusted paper edge all pass the .02 gate. Otherwise an independent `UP`/`DOWN` paper candidate may be logged. These are NOT broker orders.
- `KalshiStudyJsonlStore`: single-writer JSON Lines append-only host-local journal; SHA-256 per payload, file sync before acknowledgement, verified restart, duplicate receipt refusal, partial/corrupt ledger fail-closed.
- `kalshiStudySheetRows`: standardized report rows for later owner-authorized Google Sheets ingestion; all outcomes remain pending until independently verified with official settlement evidence.

## Required missing steps before all-day forecasting claim

1. A separately approved and authenticated **persistent server worker** (not iPhone, not an HTTP serverless function) with read-only Kalshi WebSocket and reconnect/backoff:
   - Production WS: `wss://external-api-ws.kalshi.com/trade-api/ws/v2`; sign WebSocket GET handshake with server-side API key. Read-only worker must not contain order-write paths.
   - Subscribe to `orderbook_delta` by exact `market_ticker`, and to `cfbenchmarks_value` with `index_ids:["BRTI"]`. Validate subscribe ack, SID/SEQ, snapshot, delta and index source timestamps; recover book with `get_snapshot` after gaps.
   - Preserve BRTI's official `last_60s_windowed_average_15min` for settlement research; do not substitute spot charts or single latest tick for settlement.
2. Market rollover by independently verified metadata, never guessed times/strikes. Reject ambiguous or unknown markets, clock drift, missing source or connection gaps. Append `NOT_OBSERVED` records to coverage reporting when no live data exists; do **not** backfill prediction receipts.
3. Commission an independently calibrated probability model. Each estimate needs `modelId`, evidence IDs, source cutoff and freshness; a screenshot-based guess is not qualified.
4. Exact fee model, book depth, slippage/quantity model and validated simulated fills, then score forecasts against market-implied and baseline estimates.
5. Store official resolutions **separately** as append-only outcomes after publication; verify exact ticker, rule, result and closing BRTI final-minute average.
6. Google Drive worker OAuth/Sheets writer must be separately authorized on the actual host. Export *reports/snapshots* to the existing archive using idempotent keyed rows; never share trading secrets in Google Sheets.
7. Demonstrate full 24-hour cycle (up to 96 windows) plus multi-day replay, logged outages, measured p50/p95/p99 processing lag and independent audit. Only then claim all-day coverage.

## Verification
```bash
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core exec tsx --test src/kalshi-15m-fast-paper.test.ts src/kalshi-15m-study-recorder.test.ts
```

No proof of a live, persistent Kalshi stream or Google Drive automatic recording is claimed until the associated worker is commissioned and an actual 24-hour sequence is externally verified.

## Safety
`PAPER_ONLY` and `canSubmitOrders:false` on every case; no stored Kalshi secrets, payment accounts, order submission, broker trade intents or unattended wagers. Live betting (if later requested) would require a separately designed governed execution scope and explicit approval.
