# JHADINA-KALSHI.04 — signed read-only feed + Drive export adapters

**State:** source and synthetic tests proposed on stacked draft PR, not deployed, no actual Kalshi authenticated stream or worker OAuth proven. **No trading authority.**

## Source components
- `kalshi-15m-wss-transport.ts` signs `GET /trade-api/ws/v2` with server-side RSA-PSS or Ed25519 credentials; host-pinned production/demo WSS. Subscribes **only** `orderbook_delta` for provider-verified market ticker and `cfbenchmarks_value` with `index_ids:["BRTI"]`. Requires both authenticated subscription acknowledgments, buffers early snapshots, rejects subscription errors, filters book/index SID, and disconnects after an extended silent BRTI feed. Does **not** implement orders, cancel, transfers or wallet controls.
- The physical socket implementation is injected as `KalshiServerSocketFactory`; it must support custom headers during the handshake (e.g. a pinned, separately installed `ws` package). Do **not** supply the browser WebSocket as it lacks the required handshake header support. The source library alone does not open any network connections.
- `kalshi-15m-google-sheets-writer.ts` accepts an explicitly authorized **worker** OAuth token supplier. It reads the dedicated 'Horizon Receipts' Google Sheet, reconciles exact ticker:horizon keys and SHA-256 observation hashes, appends in RAW mode only when absent, and refuses mismatched/falsified evidence. A remote API timeout can be retried after a fresh read. One writer only; Google Sheets is a report, not the authoritative ledger.
- `kalshi-15m-server-compose.ts` connects the signed read-only feed to the .03 supervisor and fsynced host-local JSONL journal. Drive exports are optional and can retry independently. The service **does not** synthesize independent prediction model probabilities or unverified fees; this means an authenticated live observation can produce **naive baseline guesses**, but research trading candidates still ABSTAIN.
- .03 metadata admission uses the correct BTC threshold type: `greater_or_equal`; the *event ticker* from a URL is not necessarily the *actual market ticker*.

## Required host and permissions
1. Choose a persistent, approved worker with durable volume. None has been provisioned as part of this PR. No spending was authorized.
2. Provide a pinned socket factory supporting TLS 1.2+/certificate validation, Kalshi signed custom headers, and automatic ping/pong. Runtime secrets `KALSHI_API_KEY_ID`, `KALSHI_PRIVATE_KEY` or Base64 PEM must stay in host secret storage; never copy to Sheets or git.
3. Confirm actual provider market metadata: `ticker`, `event_ticker`, `floor_strike`, `close_time`, `rules_primary`, `strike_type: greater_or_equal`, and the official final-minute settlement averaging rule.
4. Configure one process per durable ledger path; enforce a single-worker lease or platform replica count=1. Host must mount stable storage and support boot restart.
5. To turn on Drive reporting, authorize a **separate** Google OAuth/service account on host with least-privilege Sheets scope and explicit editor access to the existing owner report. The ChatGPT connector DOES NOT grant background worker access.
6. Capture actual historical receipts over one full day; verify no backfilled predictions, stale-feed abstention, source-to-receipt timestamps and official settlement results. Only then call it active.
7. Periodic summary can use [Google Sheet](https://docs.google.com/spreadsheets/d/1l-heS5CLxx-TyucPa6jQNIZt06axoWiqBB73M5utdPo/edit) and [Homebase folder](https://drive.google.com/drive/folders/1rkvduEQq6qSf2kqI8J04tydj0USPp0SK). Existing rows are not historical observations until the feed collects them.

## Current limitations
- The full signed WebSocket transport is a library accepting a socket factory, not a connected daemon. An executable Node host composition/CLI, installed pinned socket implementation, process isolation, live subscription validation, reconnect jitter, supervised shutdown/export drainage, active fee model, independent calibrated prediction model and verified settlement fetch remain.
- The Google Sheets writer only appends 'Horizon Receipts'; the 96-slot 'Window Ledger' and 'Health and Outages' still require separately validated derived projections.
- The .02/.03 prior draft PRs remain open. Changes are stacked on .03, not merged or deployed.
- Real-money wagering is strictly excluded: `canSubmitOrders:false`.

## Verification
```bash
pnpm --filter @jhadina/money-core type-check
pnpm --filter @jhadina/money-core exec tsx --test \
  src/kalshi-15m-fast-paper.test.ts \
  src/kalshi-15m-study-recorder.test.ts \
  src/kalshi-15m-study-worker.test.ts \
  src/kalshi-15m-wss-transport.test.ts \
  src/kalshi-15m-google-sheets-writer.test.ts
```

## References
- [Kalshi WSS connection and signing](https://docs.kalshi.com/getting_started/quick_start_websockets)
- [Order book channel](https://docs.kalshi.com/websockets/orderbook-updates)
- [BRTI channel and final-minute window](https://docs.kalshi.com/websockets/cfbenchmarks-value)
- [Study tracker #1241](https://github.com/bookieandco/crispy-waddle/issues/1241)
