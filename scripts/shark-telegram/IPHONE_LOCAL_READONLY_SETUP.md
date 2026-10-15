# TELEGRAM-IPHONE.01 — read-only personal Telegram client on an iPhone

**Status:** phone-first, code-only setup instructions. Not device-certified or deployed.
**Goal:** enable a personally authorized, read-only *live* observation of new
incoming cloud messages (private chats, groups and channels) **without forwarding**.
The existing Bot API `@R2dice2bot` cannot access your separate inbox.

## Before beginning

- You already have your **own** Telegram `api_id` and `api_hash` from
  https://my.telegram.org/apps and an independently verified positive numeric
  owner account ID, previously sent privately by `@R2dice2bot`.
- Only use a device you control. Never paste API hash, one-time login code, 2FA
  password, owner session SQLite file or sensitive chat contents in ChatGPT,
  GitHub, Google Drive, Colab, screenshots or a public/private repository.
- Read https://core.telegram.org/api/terms and
  https://telegram.org/tos/content-licensing first. This does **not** give
  Jhadina permission to scrape third-party chats for AI training. The current
  all-new-chats mode only emits transient local regex **counts**; no raw
  message/identifier, token address, AI training record or persistent event.
- No Secret Chats, deleted content, backfill, protected media, user DM export,
  AI/ML ingestion, real trading, wallet access, database write or automatic
  Telegram reply is enabled.
- The free iSH terminal may work as a **foreground test host**; its use with
  the pinned Telethon version is **not verified on a real iPhone** in CI.
  Its process can suspend when the phone locks, sleeps, or switches apps.
  Do **not** treat it as a 24/7 listener or try background-location hacks.

## iPhone-only experimental foreground setup

1. Install the free **iSH Shell** app (https://ish.app/) on your iPhone.
   It is an Alpine-like local Linux terminal. Open iSH and **keep it in
   the foreground during the collection test**; the iSH keyboard has a Paste
   key.
2. In iSH, run these ordinary setup commands **one line at a time**.
   They contain no secrets. No Git clone: the Jhadina repository is too large
   for a sensible phone download.

```sh
apk update
apk add python3 py3-pip curl ca-certificates
umask 077
mkdir -p "$HOME/.local/share/jhadina-telegram" "$HOME/jhadina-telegram-code"
chmod 700 "$HOME/.local/share/jhadina-telegram" "$HOME/jhadina-telegram-code"
cd "$HOME/jhadina-telegram-code"
```

3. Fetch the three reviewed source files *directly* from the **draft branch**.
   Never fetch secret files or files sent to you by untrusted contacts.

```sh
BASE=https://raw.githubusercontent.com/bookieandco/crispy-waddle/feat/shark-memecoin-research-training-20261012/scripts/shark-telegram
curl -fsSL "$BASE/start_personal_live.py" -o start_personal_live.py
curl -fsSL "$BASE/telegram_intake.py" -o telegram_intake.py
curl -fsSL "$BASE/requirements.txt" -o requirements.txt
```

4. Use a private Python environment and pinned Telethon. If a command errors,
   stop and investigate locally; do not bypass package security or upload
   private login diagnostics.

```sh
python3 -m venv "$HOME/.local/share/jhadina-telegram/venv"
"$HOME/.local/share/jhadina-telegram/venv/bin/python" -m pip install -r requirements.txt
"$HOME/.local/share/jhadina-telegram/venv/bin/python" -c 'import telethon; print("TELETHON_INSTALLED")'
```

5. **Only in the local iSH terminal**, run:

```sh
"$HOME/.local/share/jhadina-telegram/venv/bin/python" start_personal_live.py
```

Type `YES` for explicit consent. The launcher then prompts privately for
your app ID, app hash and **numeric user ID** (not phone number). After that,
Telegram may ask you to enter your phone number, login code from Telegram
and 2FA password **in iSH only**. Switching to Telegram to read the code may
suspend iSH; resume iSH or retry if the challenge expires. No secret is
entered into GitHub, ChatGPT, or browser-based cloud terminals.

A *connected* listener is expected to print:
`READ_ONLY_LIVE_LISTENER_STARTED ALL_NEW_INCOMING_CLOUD_CHATS`
(and `NO_AI_TRAINING; ALL_CHATS_EPHEMERAL_ONLY; NO_TRADES`).
This line alone is **not proof of receiving a real message**.

6. While iSH is still running and connected, have a permitted Telegram chat
send a **new**, ordinary text message with a token-address-format candidate.
Success should print a **count-only** `NEW_TOKEN_MENTIONS` line. Do not use
a screenshot or copy the token text into a public issue. Keep a non-sensitive
PASS/FAIL note locally and validate wrong-account rejection.

Stop with Control-C in iSH. Do not claim overnight coverage or missed-message
replay. The app may be suspended by iOS at any time.

## Safety and operator recovery

- `owner.session` is a powerful Telegram login credential located under
  `~/.local/share/jhadina-telegram/`. Treat it as a password; app container
  encryption and backup behavior are not independently verified by this CI.
- To inspect **presence only** (not connectivity), run
  `python telegram_intake.py operator-status` within the above directory.
- Revoke the added session in Telegram → Settings → Devices. The local
  session is no longer trusted once revoked. Delete the local session file
  from your trusted terminal if discontinuing this integration.
- `--all-chats` is **new-message only**, non-AI, non-persistent. Historical
  per-chat scans are a separate explicitly scoped, reviewed workflow, not
  authorized here. Telegram Secret Chats are device-specific and outside this
  client.
- For **phone-off / always-on** collection you need an additional trusted,
  continuously running host holding the personal-account session. Do not copy
  the session into GitHub Actions/Vercel/Drive/Colab; confirm hosting costs,
  privacy, data-use terms, and owner authorization first. **No hosting or
  persistent worker has been commissioned**.
- The existing personal-live release gate, offline tests, and audit/repair hold
  [#1238](https://github.com/bookieandco/crispy-waddle/issues/1238)
  still apply. No live certification and no automatic merge.

## Acceptance states

| Test | Expected | Current evidence |
| --- | --- | --- |
| Code safeguards and synthetic events | CI should pass | Existing draft suite |
| iSH package installation and Telethon | Success on owner iPhone | **UNVERIFIED** |
| Personal Telethon login | Same account as verified bot | **UNVERIFIED** |
| Real incoming message | Count-only local marker | **UNVERIFIED** |
| Lock/sleep/reconnect/revocation | Fail closed, missed coverage disclosed | **UNVERIFIED** |
| Always-on/private hosting | Separately authorized worker | **NOT DEPLOYED** |
| AI model ingestion or trading | Denied | **DISABLED** |
