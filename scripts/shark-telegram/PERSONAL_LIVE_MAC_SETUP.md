# Jhadina — securely log into your personal Telegram on a Mac

**Prerequisites:** you already created a Telegram app at https://my.telegram.org/apps
and have an `api_id` and `api_hash`. Keep both private. You also previously
verified the numeric account ID through private `@R2dice2bot` replies.

Your BotFather bot token is **not** used for a personal Telegram login.
GitHub Actions secrets **do not** automatically appear on your Mac.

## Audit/repair hold and code-only milestones

Trusted-Mac login and a genuine personal-account event readback are **deferred**
under [TELEGRAM-LIVE.08 audit/repair #1238](https://github.com/bookieandco/crispy-waddle/issues/1238).
Do not treat the Bot API's previously verified owner receipt as proof that a
separate Telethon personal login is working. API ID/hash, phone login code,
2FA and `owner.session` must stay on the owner-controlled Mac.

In the meantime, code-only TELEGRAM-LIVE.09 simulates real asynchronous
new-message/edit events through a fake Telethon client, including new/unknown
chat peers, exclusions, malformed events, wrong-account rejection, session lock
cleanup and zero-persistence assertions. This **does not connect Telegram**.

TELEGRAM-LIVE.10 adds local deterministic crypto-only notices, e.g.
`NEW_TOKEN_MENTIONS 1 SOLANA_FORMAT 1 EVM_CHAIN_UNRESOLVED 0 MIGRATION_CLAIM_ONLY 1 PUMPSWAP_MENTION_ONLY 1 RUG_RISK_CLAIM_ONLY 0 UNVERIFIED_NO_AI_NO_TRADE`.
They carry no raw message, token contract address, account ID, chat ID or sender,
and are not prediction scores, verified on-chain events or training data.

This stage cannot run unattended when the laptop is asleep/offline and is not
configured for historical inbox backfill. Hold merge and production sign-off
until the audit/repair checklist has been independently verified.

## TELEGRAM-LIVE.12 — offline startup certification

Code-only startup diagnostics are available without Telegram login, API calls,
message reads, HMAC secrets, exports, wallet access, or AI/ML processing:

```bash
"$HOME/.local/share/jhadina-telegram/venv/bin/python" personal_startup_diagnostics.py
```

Run it on your trusted Mac **after** installing the pinned dependencies
below. It requires Python 3.11+ and `Telethon==1.45.0`; the application
does not repair dependencies automatically. The diagnostic refuses CI,
Vercel, symlinked or insecure local Telegram session storage. A successful
result contains `PREFLIGHT_LOCAL_READY_TO_ATTEMPT_LOGIN` and
`NETWORK_NOT_CHECKED`: this verifies **only local prerequisites**, not
whether the session is authenticated, currently connected, receiving any
messages, or collecting historical data. `TELEGRAM_SESSION_PRESENT` means a
protected file exists, **not** that its credential is valid. The diagnostic
does not create the private directory or read session bytes.

On the same Mac, offline regression tests can be run without an account:

```bash
"$HOME/.local/share/jhadina-telegram/venv/bin/python" -m unittest discover -s . -p 'test_*.py' -v
```

These simulate startup, owner mismatch, incoming messages, reconnect and
recovery. They cannot substitute for the deferred live-account acceptance
checks under [audit issue #1238](https://github.com/bookieandco/crispy-waddle/issues/1238).
Review the status labels locally; never paste account IDs, API hashes,
login codes or session files into issues/PR comments.

## TELEGRAM-LIVE.13 — production release remains held

The [release gate](PERSONAL_RELEASE_GATE.md) and
[fixed no-secrets evidence manifest](personal_release_evidence.json) now
certify only offline code requirements. The GitHub workflow must prove
both `--mode ci` passes **and** `--mode release` refuses production.
This guard is **not** a live Telegram login and must never be bypassed by
marking a checklist as verified without independently reviewed owner-device
evidence. [Audit issue #1238](https://github.com/bookieandco/crispy-waddle/issues/1238)
remains open.

To inspect the two read-only gates locally after cloning the draft branch:

```bash
"$HOME/.local/share/jhadina-telegram/venv/bin/python" personal_release_gate.py --mode ci
"$HOME/.local/share/jhadina-telegram/venv/bin/python" personal_release_gate.py --mode release
```

The second command intentionally exits **1**: this is an expected production
HOLD, **not** failed Telegram authentication. No keys or message content
are requested by either gate.

## First run on a trusted Mac

Open **Terminal** on the Mac and paste these commands, one line at a time:

```bash
umask 077
git clone --branch feat/shark-memecoin-research-training-20261012 --single-branch https://github.com/bookieandco/crispy-waddle.git
cd crispy-waddle/scripts/shark-telegram
python3 -m venv "$HOME/.local/share/jhadina-telegram/venv"
"$HOME/.local/share/jhadina-telegram/venv/bin/python" -m pip install -r requirements.txt
"$HOME/.local/share/jhadina-telegram/venv/bin/python" start_personal_live.py
```

The onboarding script will ask for explicit **YES** consent before running, then
prompt for three values with **hidden input**:

- Your Telegram app's numeric `api_id` from my.telegram.org
- Your private `api_hash` from that same Telegram page
- Your **numeric Telegram account ID** from the PRIVATE bot reply in
  https://t.me/R2dice2bot (do not enter your phone number in this field)

Then Telethon itself may ask for your **Telegram phone number**, an **in-app
login code**, and your **Telegram two-step verification password**, if enabled.
Only type them in the trusted Mac Terminal. Never post them in GitHub, chats,
screenshots, pastebins or issue comments. A genuine login request may also
appear as a new Telegram authorization on your phone.

The program checks that the signed-in **personal Telegram account ID** matches
the verified numeric owner ID. An unexpected login is rejected. When it is
successfully connected, the terminal prints
`READ_ONLY_LIVE_LISTENER_STARTED ALL_NEW_INCOMING_CLOUD_CHATS`.

To verify, have an authorized crypto chat/channel send a **new** ordinary
message containing a token-address-like value **while the Mac listener is
running**. You should see `NEW_TOKEN_MENTIONS` and a count, but the message
text, wallet, chat, sender and contract are not printed or saved.
A message sent **before** starting is not evidence of live receipt.

## TELEGRAM-LIVE.11 — reliability and offline operator controls

The listener now supervises transport failures with bounded pauses
(2, 5, 15, 30, 60 seconds) and re-verifies the same Telegram account after
every successful reconnect. It never silently pairs another owner. A clean
stop is **not** interpreted as an error; interruptions and cancellation do
not cause an unwanted auto-restart. After failed attempts, it exits safely
with `TELEGRAM_RECONNECT_EXHAUSTED_NO_HISTORY_REPLAY`. It does **not** fetch
messages missed during disconnection and is not proof of always-on coverage.

While on your trusted Mac, in the already-cloned folder, you can run this
**without entering the app ID/hash, 2FA or HMAC key**:

```bash
"$HOME/.local/share/jhadina-telegram/venv/bin/python" telegram_intake.py operator-status
```

This reads only whether the protected local Telethon session file **exists**
and whether the local worker's advisory lock is **held**. It intentionally
ends with `NETWORK_NOT_CHECKED`: a held lock means only a process owns the
local lock; it does **not** prove Telegram connectivity or successful event
reception. No account IDs, chat names, contracts, phone numbers or session
contents are printed. The command refuses insecure permissions or symlinks.

When running live, the Mac Terminal uses only redacted markers:
`TELEGRAM_CONNECTION_INTERRUPTED`, `TELEGRAM_RECONNECT_ATTEMPT`,
`TELEGRAM_CONNECTION_RECOVERED_OWNER_VERIFIED`,
`TELEGRAM_LOCAL_LISTENER_STOPPED`, or
`TELEGRAM_RECONNECT_EXHAUSTED_NO_HISTORY_REPLAY`. A lost connection is
**not** taken to mean there were no messages during the outage.

GitHub tests simulate these sequences; the genuine Mac login and real-message
certification remain held by [audit issue #1238](https://github.com/bookieandco/crispy-waddle/issues/1238).

## Stop, restart, privacy

Press **Control-C** in Terminal to stop it. The Mac must be running, online,
and awake; no always-on service is provisioned, and you may miss events
while disconnected. To restart in the already-cloned folder:

```bash
"$HOME/.local/share/jhadina-telegram/venv/bin/python" start_personal_live.py
```

App ID/hash must be entered each time for now; the launcher does not write
these application credentials to disk. Telethon *does* save a sensitive user
login session in `~/.local/share/jhadina-telegram/owner.session` (0600).
Treat that file as a password. Never upload it to GitHub Actions, Google Drive,
Vercel, screenshots, or chats. To revoke the login, use Telegram app →
Settings → Devices, terminate the Jhadina/Telethon session.

All-new-chats mode is **local deterministic regex observation only**: no raw
or derived messages stored, no AI/ML training, no watchlist promotions or trades.
Current Telegram API terms prohibit using Telegram API data to develop/train
AI/ML systems: https://core.telegram.org/api/terms

The existing SHARK PR is still draft and has **not** connected the personal
account or certified an end-to-end incoming-message run yet:
https://github.com/bookieandco/crispy-waddle/pull/1230

This setup needs a trusted Mac (or similarly trusted local computer). An
iPhone Safari tab or GitHub Actions runner cannot safely act as the persistent
personal Telegram user session in this architecture.
