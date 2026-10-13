# Jhadina — securely log into your personal Telegram on a Mac

**Prerequisites:** you already created a Telegram app at https://my.telegram.org/apps
and have an `api_id` and `api_hash`. Keep both private. You also previously
verified the numeric account ID through private `@R2dice2bot` replies.

Your BotFather bot token is **not** used for a personal Telegram login.
GitHub Actions secrets **do not** automatically appear on your Mac.

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
