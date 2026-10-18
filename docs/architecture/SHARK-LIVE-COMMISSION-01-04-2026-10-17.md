# SHARK-LIVE.COMMISSION.01 → .04 — operator closeout handoff

**2026-10-17.** Canonical worker: `ops/meme/shark_live_intelligence.py`.
**Current state:** NOT COMMISSIONED. No new paid services, host, Telegram send, or trade enabled.

## .01 — Existing-host inventory (observed)

- **Vercel:** `crispy-waddle-jhadina-web` serves Jhadina's web/PWA, not an always-on Python worker with a guaranteed durable local SQLite volume.
- **Railway:** only projects **OverageOS** (no services/volumes) and **PupsonStuff Media Services** (active unrelated services, **no attached volumes**). Do not hijack PupsonStuff or change its staging/deployments for SHARK; no SHARK-specific service was present.
- **RunPod SHARK Shadow:** an existing `SHARK Shadow Live Watchdog` schedule is failing; no healthy verified SHARK public monitor or persistent-volume recovery evidence. Do not assume the scheduled check proves a running host.
- **GitHub Actions:** `Jhadina SHARK seven-day memecoin observation (paper-only)` is separately scheduled until October 20, 2026; its state is on a Git data branch and does not substitute for an always-on stateful host or reliable two-minute polling.
- **Conclusion:** zero approved/persisted, verified SHARK-LIVE runtime targets today. The next host must have persistent owner-controlled private disk, bounded provider egress and an explicit free/cost approval. None was created here.

## .02 — Local durable recovery *source certified, off-host blocked*

`ops/meme/shark_live_commission.py` implements:
- `recovery-drill`: verify schema, SQLite quick-check, public-only cohort/study custody, mint/risk/outbox constraints, and restore a fully committed SQLite online snapshot into a second **separate** 0600 owner-only file. Compare deterministic complete ledger fingerprints. Never overwrite a real database.
- `backup`: exclusive new local 0600 SQLite snapshot using SQLite's backup API, fsync and atomic hard-link publication. Cannot overwrite a same-path file, follows no destination symlink, and requires a trusted non-group/world-writable parent.
- `notify-preflight`: *without calling Telegram*, verify the owner notification permission is explicitly opted in by both CLI and environment; never log recipient, token, or chat contents.

Operator local-only commands after the trusted host is selected:

```sh
mkdir -p -m 700 "$HOME/.local/share/jhadina/shark-public"
python3 ops/meme/shark_live_intelligence.py --mode audit \
  --state "$HOME/.local/share/jhadina/shark-public/observations.sqlite3"
python3 ops/meme/shark_live_commission.py --mode recovery-drill \
  --state "$HOME/.local/share/jhadina/shark-public/observations.sqlite3"
python3 ops/meme/shark_live_commission.py --mode backup \
  --state "$HOME/.local/share/jhadina/shark-public/observations.sqlite3" \
  --backup "$HOME/.local/share/jhadina/shark-public/backup-001.sqlite3"
python3 ops/meme/shark_live_commission.py --mode notify-preflight
```

**Local backup ≠ production DR:** this neither encrypts nor copies the DB off-host. For production, separately verify encrypted off-host transfer, access grants, scheduled backups, immutable retention, restore-on-a-different-host, owner recovery procedure and loss/restore metrics. Never write raw Telegram records, private keys or personal identifiers into the public-market DB.

## .03 — One permitted live public feed canary (pending for new worker)

Past real manual `Jhadina SHARK Public Market Canary` GitHub run **#39084988302** returned `PUBLIC_MARKET_PARTIAL_NOT_ALPHA` after a public mint RPC + DEX check. This demonstrates that the separate **bounded canary** successfully reached providers on that date. It does not certify the new always-on worker's exact runtime, sampling latency, market history or owner host.

A prospective operator host must execute a single **deliberate** public-only worker cycle after reviewing provider terms / rate limits and collecting start/end wall-clock evidence:

```sh
python3 ops/meme/shark_live_intelligence.py --mode once \
  --state "$HOME/.local/share/jhadina/shark-public/observations.sqlite3" \
  --confirm PUBLIC-MARKET-RESEARCH-ONLY
```

Evidence expected: a truthful status (new discoveries, checked public mints, quarantines, paper unscored cases), immutable-as-possible external timestamp and provider provenance independently reviewed, no Telegram ingestion or trades. The worker **does not** claim full new-launch coverage, true sellability, successful trading, exact first launch time, or production subsecond latency. On network failure it must fail closed. Do not run the continuous `serve` mode on GitHub Actions.

## .04 — Owner-only private research alert verification (pending actual send)

Code route `shark_live_intelligence._private_sender` **only** sends public RPC/DEX research messages to a protected single Telegram user. It never calls `getUpdates` or consumes Telegram messages. Alerts default OFF and require `--notify`, `ENABLE_SHARK_PUBLIC_ALERTS=true`, protected bot token and owner ID on the approved runtime. Max two per cycle; keys are claimed before delivery, and failed/uncertain sends are **not retried**. A successful earlier private Telegram bot reply does not prove this new worker's alert delivery.

Use:

```sh
python3 ops/meme/shark_live_commission.py --mode notify-preflight --approve-notification-check
```

No message is sent. After owner authorization and host/credentials are verified, a real public-market **one-shot**, owner-private canary may run with `--notify` and explicit env enabled. Record send status and confirm the phone actually received it; do not log bot secret, recipient ID or contents.

## Nonnegotiable release gates

| Gate | Status |
| --- | --- |
| Code-only public pipeline, replay protection, no-trade tests | CI proven |
| Local SQLite snapshot/restore, corruption and exclusive-creation tests | Added here; CI must pass |
| Source-only credentials preflight without Telegram send | Added here; CI must pass |
| Dedicated persistent host / approved cost / private disk | BLOCKED — no qualified existing host |
| Genuine new-worker public-provider cycle and rate-limit evidence | BLOCKED — owner host needed |
| Encrypted off-host restore and host-failure drill | BLOCKED — external infrastructure |
| Owner-private SHARK Live alert readback on phone | BLOCKED — opted-in deployed runtime |
| Bot manual one-shot preview and public-market mode | Previously working; **separate** |
| Personal-account Telegram ingestion / AI learning | NOT AUTHORIZED; draft PR #1230 / issue #1238 |

Nothing in this target enables personal-account Telegram scanning, Telegram-derived AI/ML training, automatic trading, wallet signing, spending, or a paid host.

**Next bounded acceptance:** operator-approved trusted SHARK host with durable private storage, real monitored public feed, off-host encrypted restore, measured alert latency, and phone readback. Do not mark commissioning complete before these external receipts exist.
