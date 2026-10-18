# SHARK-LIVE.ACCEPT.12–.15 — bounded multi-cycle and alert-source acceptance

**Date:** October 17, 2026. **Status:** Synthetic, source-only. Neither a 24-hour real-market outcome nor live phone delivery is certified.

The genuine public one-shot on 2026-10-17 20:10 PDT (GitHub run #39092651536) found two market candidates, checked both public mints and opened two *ephemeral* paper cases in 0.616 seconds. That run deliberately erased state, so it does not provide 24–30-hour outcome proof or a continuous host.

## .12 — Multi-cycle acceptance without a second market engine

`ops/meme/shark_acceptance_multicycle.py --mode synthetic-rehearsal` invokes the existing canonical `shark_live_intelligence.tick` with explicitly synthetic Solana public-schema fixtures, using separate SQLite opens between five committed cycles. It does not contact providers, poll Telegram, train models or use trading keys. Records remain in a private temporary directory and are removed afterward. GitHub's source CI runs this offline.

## .13 — Prospective paper and censoring

The synthetic scenario starts two public-format, unscored cases; observes both before the 24-hour horizon (still unscored); then tests a 24-hour same-pair price-only calculation for exactly one case. Its second case has missing later evidence and is censored after the eligible window. The 20% result in the test is **made-up fixture arithmetic**, NOT a real token's return, a simulated fill, executable P&L or a verified trading strategy.

The existing `public_alpha_study` chain is checked across separate database opens. The 50/50 no-edge Brier reference remains suppressed due to insufficient real prospective evidence.

## .14 — Interrupted process and local recovery

The exercise triggers an unexpected exception during a pending cycle, closes the SQLite connection, reopens the same database and proves the interrupted cycle was rolled back. It then resumes once, without invented historical predictions. Real SQLite online backup/restore drills run both before and after multi-cycle progress, checking fingerprints. These are **local**, not encrypted off-host backup or a second-host disaster recovery certificate.

## .15 — Owner-private output controls, NOT phone delivery

The canonical notifier's send-only function is tested with a mocked, allowlisted recipient and no API calls. One delivery is marked `UNCERTAIN_NO_RETRY` to simulate an ambiguous send; reopening the database does not re-send that event. The actual worker now rejects `--notify` in uncommissioned or audit mode even if credentials exist; no automatic or test-time Telegram messages are sent.

Owner-private delivery on an actual phone still requires a separately commissioned trusted host, preexisting bot credentials and explicit consent. Proof of local mocked delivery **is not** proof of owner phone readback.

## Manual source-only acceptance

```sh
python3 -m unittest discover -s ops/meme -p 'test_shark_acceptance_multicycle.py' -v
python3 ops/meme/shark_acceptance_multicycle.py --mode synthetic-rehearsal
```

For an EXISTING owner-private SQLite ledger only (no network), run:

```sh
python3 ops/meme/shark_acceptance_multicycle.py \
  --mode audit-existing --state /absolute/private/path/observations.sqlite3
```

This reads known public-only SHARK state under the existing single-writer lock. If the file is absent, unsafe or corrupt, the audit fails closed; it must never invent an empty database. It does not authorize a market worker or delivery.

## Final release boundary

- No real 24–30-hour prospective market case is certified from the transient first run; the real production ledger and independent provider provenance are still pending.
- No owner-approved dedicated permanent host, remote encrypted restore, long-running latency measurement or Telegram phone alert has been commissioned.
- No Telegram message content is ingested or used for AI/ML. Personal Telegram listener PR #1230 / issue #1238 remains off.
- No wallet signing, trades, payments or unapproved expenses.

Issue [#1374](https://github.com/bookieandco/crispy-waddle/issues/1374) remains the external acceptance tracker. This PR may merge only after exact-head offline SHARK, Spatial and Jhadina Launch CI passes, without implying production commissioning.
