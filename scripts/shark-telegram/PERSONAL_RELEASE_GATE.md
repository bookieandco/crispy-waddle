# TELEGRAM-LIVE.13 — Release-readiness gate and evidence contract

**Scope:** personal Telegram account's new incoming cloud messages, **not**
`@R2dice2bot` Bot API. This is a draft, code-only research project.
**Status:** production admission is intentionally **HELD**.

## What CI actually certifies

The SHARK Telegram workflow runs the offline unit suite and then:
```bash
python3 scripts/shark-telegram/personal_release_gate.py --mode ci
```
Success prints `TELEGRAM_LIVE13_CODE_CONTRACT_VALID` and
`TELEGRAM_LIVE13_PRODUCTION_PERSONAL_LISTENER_HELD`.

The same workflow verifies that:
```bash
python3 scripts/shark-telegram/personal_release_gate.py --mode release
```
returns exit code **1**, a deliberate production HOLD. A missing,
malformed or self-promoted evidence file returns **2**, a failing CI result.

The fixed [manifest](personal_release_evidence.json) is deliberately
`CODE_ONLY`: it records six design/test contracts as `OFFLINE_TESTED`,
seven **live** criteria as `UNVERIFIED` and five prohibited capabilities
as `false`. The CI gate rejects extra fields, changed scope, added
permissions, fabricated live receipts, malformed data and linked evidence
files. **It does not** use a mutable JSON flag as proof of successful
Telegram authentication or authorize automatic deployment.

## Independent production evidence still required

All remain under [audit/repair issue #1238](https://github.com/bookieandco/crispy-waddle/issues/1238):
1. The owner's authenticated sign-in on an approved trusted host, including
   an iPhone-controlled SSH terminal to a private persistent Linux server,
   with API ID/hash and Telegram OTP/2FA kept exclusively on that host.
   A Mac remains an optional alternative, never a mandatory dependency.
2. Verified personal account ID equals the independently verified
   `TELEGRAM_ALLOWED_USER_ID` from the bot-side owner challenge.
3. Fresh new incoming crypto-format message received **while connected**.
   Record a sanitized acceptance receipt with no chat text, account ID,
   contract address, sender or token credentials in GitHub.
4. Disconnect/reconnect, sleep/offline, missed-message behavior and
   explicit owner cancellation/restart observed and reviewed.
5. The owner revokes the session in Telegram Devices and confirms the old
   authorization cannot continue monitoring.
6. Separate Telegram data use and permission review. Telegram's terms
   currently restrict AI training/development with Telegram data; this
   code's all-chat path is ephemeral non-AI regex observation only.
7. Independent, explicit owner production approval after the above
   evidence is reviewed.

GitHub tests, a session SQLite file existing, the worker lock held, and
`PREFLIGHT_LOCAL_READY_TO_ATTEMPT_LOGIN` are **not** live evidence.
The standalone gate has no `--force`, `--approve`, or `--deploy`
switch. A **separate reviewed milestone** must establish verifiable
owner-device live receipts and change the release policy; no fake evidence
or accidental PR merge should remove this hold.

## Security and operational limitations

- No raw or derived Telegram message archive, no permanent read history,
  no automatic history backfill, AI/ML training, or trade execution.
- CI does not receive the owner's API keys, 2FA, session, Telegram updates,
  account ID or a private data volume. There are no production secrets
  in `personal_release_evidence.json`.
- Local foreground mode requires an awake trusted device; the separate
  cloud path requires approved dedicated persistent hosting, a securely enrolled
  session, and real owner/device release evidence. Neither is **deployed**.
- This gate protects the personal user reader; it does **not** greenlight
  other draft SHARK/Shadow bots, market-data rights, wallet features or
  funding requests.
