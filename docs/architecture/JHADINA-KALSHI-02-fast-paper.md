# JHADINA-KALSHI.02 — BTC 15m fast paper boundary

**Status:** source implementation and synthetic unit tests, **not connected to a live Kalshi WebSocket**, not latency-certified and **no order execution**.

## Why this exists

A screenshot captured with 3m50s left showed BTC at $83,603.89 against a displayed target of $83,531.59; a falling chart did **not** mean BTC was currently below the reference. Fast systems must prioritize source freshness and settlement semantics over visible arrow direction.

Existing repository boundaries:
- `apps/jhadina-web/src/lib/kalshi/kalshi-health.ts` performs signed, read-only auth health checks.
- `packages/money-core/src/prediction-market-reality.ts` models provider-neutral quote and resolution truth.
- `packages/money-core/src/prediction-market-intelligence.ts` compares evidenced model estimates with market prices without granting capital authority.
- `packages/money-core/src/shadow-market-contracts.ts` asserts read-only observation.

This milestone adds a **separate streaming-frame reducer and paper-only decision gate**, not a second execution stack.

## Verified official protocol contracts

- Production WSS: `wss://external-api-ws.kalshi.com/trade-api/ws/v2`; authenticated GET WebSocket handshake with signed Kalshi API key headers.
- `orderbook_delta` subscription filtered by exact `market_ticker`, not market id. The `orderbook_snapshot` is followed by incremental `orderbook_delta` frames. Reconstruct yes/no bids and invert the opposite bid for the executable **ask**. A sequence discontinuity invalidates the local book and requires a fresh snapshot.
- `cfbenchmarks_value` subscription with `index_ids:["BRTI"]`. Parse the JSON string in `msg.data` and use upstream event time; `index_id` must be `BRTI`. Kalshi provides trailing and special final-minute average fields on this feed. The official contract rules, not a single last-tick chart price, determine the final result.
- Subscribe to the dedicated `cfbenchmarks_value_5hz` only in a separately validated follow-on path if your entitlement and matching schema support it. Faster source ticks do not guarantee faster end-to-end decisions.

Official references:
- https://docs.kalshi.com/websockets
- https://docs.kalshi.com/websockets/orderbook-updates
- https://docs.kalshi.com/websockets/cfbenchmarks-value
- https://help.kalshi.com/en/articles/13823838-crypto-markets

## Current source addition

`packages/money-core/src/kalshi-15m-fast-paper.ts`

- An event-driven reducer accepts **pre-authenticated, read-only Kalshi frames** from a future worker.
- Exact market binding; BRTI index binding; snapshot-first book; per-subscription ordering and strict sequence continuity.
- Never treats chart direction as outcome probability or overwrites an independent estimate with the market quote.
- Fails closed on stale book/index, missing model evidence, old model, missing per-contract fee estimate, empty book depth, settlement cutoff and book desynchronization.
- Emits `PAPER_CANDIDATE` only if the independently estimated payout probability exceeds the best-available ask price, modeled fee and minimum net-edge threshold.
- Emits **no mutation interface**; every decision is `PAPER_ONLY` and `canSubmitOrders:false`.
- Synthetic tests cover mismatch, stale timestamps, fee/no-model abstention, price-vs-target distinction, re-snapshot, malformed deltas and hard settlement cutoff.

## Commissioning gates, not yet passed

1. Implement a persistent, non-serverless stream worker with narrowly scoped read-only credentials. Never surface keys or the WebSocket handshake in iPhone/browser code. Wire one book subscription for the current ticker and BRTI index subscription.
2. Load target, open/close timestamps, official index and full rule text from the authenticated market metadata; **do not derive target or settlement method from a screenshot or URL**. Confirm exact UTC vs local display time.
3. Handle authenticated connection errors, reconnect with jitter, subscription acknowledgement, ping/pong, book re-snapshot and market rollover. Establish a monotonic timing source, track `source_ts → receive_ts → decision_ts → paper_record_ts`, track clock offset, identify gaps and disable signals during disconnect.
4. Use an independently trained probability model with evidenced point-in-time inputs and backtested calibration. Require every model estimate to be fresher than a configurable bound, never fill in with market consensus.
5. Add fee schedule from a verified provider rule; use the **actual executable ask**, fill-size and slippage model, not headline percentage. Paper record as-of quote and after-quote fills without future leakage.
6. Persist immutable replay frames, decision receipts, cancellations/voids and final settlement to a durable store, with local spool during database outage and duplicate-event protection.
7. Demonstrate live feed freshness and historical replay; validate p50/p95/p99 event-to-decision latency and disconnect recovery over multiple market windows. Proposed provisional target: p95 under 500ms for in-process evaluation, **not a guaranteed network/exchange order acknowledgement**.
8. Maintain explicit `NO_LIVE_TRADING` admission policy. Any later real-money path requires owner approval, separately governed Money Core authority, position/capital limits, order reconciliation and a functioning kill switch. No deployment may silently promote `PAPER_ONLY`.

### Acceptance command (on repository checkout)

```bash
pnpm --filter @jhadina/money-core exec tsx --test src/kalshi-15m-fast-paper.test.ts
pnpm --filter @jhadina/money-core type-check
```

The presence of these tests in GitHub is **not** evidence that they executed successfully. A green CI run or local receipt is still required.
