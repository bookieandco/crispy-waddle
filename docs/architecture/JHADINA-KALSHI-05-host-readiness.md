# JHADINA-KALSHI.05 — host bootstrap and forward-only audit

**Code complete for review; NOT DEPLOYED, NOT COLLECTING LIVE MARKET EVENTS.**
Branch `build/jhadina-kalshi-05-host-readiness` stacked on #1244 → #1243 → #1240.

## Reliability repairs

- Old worker could choose a checkpoint at the wall-clock time captured **before** slow market discovery/WebSocket setup. Now it obtains the actual **post-network** time immediately before `checkpoint()`; after the five-second tolerance, no retroactive forecast is recorded.
- Host now obtains exclusive `journalPath.lock` with atomic `wx` creation before opening the journal. A stale lock after power loss fails closed for owner investigation. No automatic lock stealing or multi-replica writing.
- On orderly shutdown, Google Sheets exports that are already in flight drain; final reconciliation follows before the lock is released. Google reporting remains downstream and optional; it cannot rewrite the primary JSONL evidence journal.
- New tests simulate slow discovery, a locked second process, tampered lock and explicit refusal of live trading.

## Runtime command (ONLY on an approved dedicated persistent host)

Root monorepo dev dependencies must be installed with frozen pnpm lock:
```sh
corepack enable
pnpm install --frozen-lockfile
```

Supply an operator-reviewed WebSocket module supporting custom HTTP handshake headers. `ws` is loaded dynamically from a dedicated host package directory; this **does not add a hidden dependency to the repository's frozen lock**, but it does require separately commissioning that module and its integrity/version pin. Example operator install (not run here):
```sh
mkdir -p /srv/jhadina-kalshi-ws
npm install --prefix /srv/jhadina-kalshi-ws --save-exact ws@8.18.3
```

Protect your Kalshi credentials in your host secrets manager. Expected variables:
```text
KALSHI_PAPER_ONLY=true
KALSHI_LIVE_EXECUTION=false
KALSHI_ENV=demo
KALSHI_API_KEY_ID=<host-secret>
KALSHI_PRIVATE_KEY_BASE64=<base64-encoded-PEM-host-secret>
KALSHI_JOURNAL_PATH=/mnt/persistent/kalshi15m/receipts.jsonl
KALSHI_WS_PACKAGE_DIR=/srv/jhadina-kalshi-ws
```

Start manually after commissioning:
```sh
pnpm --filter @jhadina/money-core exec tsx src/kalshi-15m-runtime-cli.ts
```

Ensure process manager restarts only with operator-approved lock recovery. SIGINT/SIGTERM close the stream cleanly and release the journal lock; a crash deliberately retains its lock for manual inspection. The host may print **redacted paper-only health JSON**, but never secrets, wallet data or market-order authority.

## Still not part of commission

- No host has been activated or paid for.
- No Kalshi API key, real WebSocket handshake, OAuth grant or Google Sheets uploader was configured or exercised against the user's account. The existing ChatGPT Google Drive connection is **not** inherited by a headless host.
- No model probability is yet available. The worker records an **uncalibrated naive reference direction** only where a verified fresh BRTI reading exists, but `direction=ABSTAIN` for any putative independent trade/edge decision. This is an experiment, not a strategy certification.
- Official case #001 settlement remains unverified. The 96-slot study template has no live observations.
- The launcher lacks a deployed pinned host image and an end-to-end 24h live canary; `ws` installation and Google authorization are still operator steps.
- The user has not approved billable hosting. Do not provision one implicitly.

## Next requested/approval gates

1. Review, test and merge the **stacked** drafts in order #1240 → #1243 → #1244 → .05 under repository governance.
2. Select an existing always-on host/volume or ask permission before provisioning a new billable service.
3. Establish host secrets securely; install a vetted/pinned header-capable TLS WebSocket library, verify Kalshi auth and correct BTC 15m market metadata.
4. Prove source timestamp/orderbook subscription ACK, BRTI index frame and book snapshot/delta handling; test disconnect/reconnect and idempotent journal restart.
5. Independently authorize a server-side Google service-account or OAuth token supplier, share the exact existing owner spreadsheet with that identity, prove one new immutable Horizon Receipt and a clean no-dup retry.
6. Run 24 consecutive hours of forward observations with real outage/missing-window accounting. Score official settlement separately. No real money or automatic orders.

## Links
- [Study Google Drive folder](https://drive.google.com/drive/folders/1rkvduEQq6qSf2kqI8J04tydj0USPp0SK)
- [96-window Google Sheet](https://docs.google.com/spreadsheets/d/1l-heS5CLxx-TyucPa6jQNIZt06axoWiqBB73M5utdPo/edit)
- [Current study issue #1241](https://github.com/bookieandco/crispy-waddle/issues/1241)

**Research authority only, always `canSubmitOrders:false`.**
