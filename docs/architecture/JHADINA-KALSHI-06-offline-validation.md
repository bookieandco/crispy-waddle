# JHADINA-KALSHI.06 — Offline paper-only acceptance

**Source branch:** `build/jhadina-kalshi-06-offline-validation`, stacked on PR #1245 (`057a7e4`). Do not merge/deploy on the strength of this document alone.

## Scope and code changes

1. **.06.01 source-time admission:** Book snapshot/delta freshness uses Kalshi's provider `sending_ts_ms`, not merely local receipt time. Old, future-dated, unsequenced and malformed current-book updates invalidate cached book state. Predictions fail closed until a fresh valid snapshot.
2. **.06.02 forward-only rollover:** After potentially slow discovery, market selection uses a fresh wall-clock timestamp. The exact verified ticker/close controls switching. Ambiguous discovery is not silently replaced with a cached selection.
3. **.06.03 interrupted-feed recovery:** Disconnects, sequence gaps, malformed frames, rollover, discovery failures and durable errors produce best-effort diagnostic events. A disconnected socket generation cannot issue a checkpoint. The session resets before reconnect.
4. **.06.04 durable journal:** Asynchronous writes are serialized within a process, the host lease remains exclusive across processes, and an uncertain write poisons the in-memory store until operator inspection. Receipts are hash-checked and fsynced before acknowledgement.
5. **.06.05 coverage:** `projectKalshiStudyCoverage()` derives `RECORDED`, `ABSTAINED` and `NOT_OBSERVED` from an explicit market manifest plus verified immutable receipt IDs. The coverage report is **not** an alternate prediction journal. Existing receipt outcomes remain `PENDING_SETTLEMENT`; unobserved checkpoints have null evidence hashes.
6. **.06.06 Drive boundary:** The acceptance fixture exercises report append, timeout after remote success, fresh remote reread, hash-based idempotency, missing OAuth, and preservation of the journal. All Google API calls in this gate are mocked. Real worker OAuth and real Sheets uploads remain uncommissioned.
7. **.06.07 integrated fixture:** Two consecutive synthetic markets, six expected horizons, four immutable abstention receipts, two explicitly missed horizons, plus stale-frame, corruption, duplicate, restart and old-market rejection cases.
8. **.06.08 CI:** Dedicated `KALSHI.06 Offline Paper Validation` workflow with read-only GitHub token and no market/Google secrets. It runs type-check and the Kalshi test suite, verifies output artifacts and uploads synthetic logs/report data.

## Run locally (no credentials)

```sh
pnpm install --frozen-lockfile
pnpm --filter @jhadina/money-core type-check
KALSHI_VALIDATION_ARTIFACT_DIR=/tmp/kalshi-06-evidence \
  pnpm --filter @jhadina/money-core exec tsx --test src/kalshi-15m-*.test.ts
```

## Evidence required

- `receipts.jsonl` (immutable synthetic paper receipts)
- `coverage.json` (explicit expected/missing horizons)
- `health-events.jsonl` (observed rollover/fault events within fixture)
- `archive-reconciliation.json` (mock server rows and retries)
- `validation-summary.json` and `test-results.json` (scope / unresolved claims)
- `test-output.txt` (test results and any failure)

**These are synthetic test artifacts, not genuine Kalshi events.** The workflow can certify only offline behavior after it runs successfully at the exact branch SHA. Do not report a successful test just because the workflow is defined.

## Still blocked after a successful .06 gate

- PR #1240 remains separately merge-blocked until reconciled with main. Merge stacks in order #1240 → #1243 → #1244 → #1245 → #1246 if created.
- No actual Kalshi WebSocket authentication, signed subscription ACK or observed BRTI/orderbook tick has been verified.
- No owner-approved always-on host/durable volume; no service account/OAuth grant; no real Google Sheets writer canary.
- No real 24-hour study, official settlement proof, independently calibrated model, validated fee/slippage model or profitability claim.
- No trading, orders, funding, wallet, brokerage authority, or autonomous wagering.

**Safety invariant:** `paperOnly:true`, `canSubmitOrders:false`. Forecast checkpoint receipts never backfill a missed time window; unobserved windows remain unobserved.
