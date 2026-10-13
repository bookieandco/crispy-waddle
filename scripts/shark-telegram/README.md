# SHARK Telegram message reader — research only

## Status (2026-10-12)
Code staged in draft SHARK training PR; **NOT connected to an owner Telegram account**, authenticated, run against live messages, or deployed. No Telegram subscription is required. No Telegram OAuth/session keys are held by ChatGPT or GitHub.

Design references (not embedded dependencies):
- https://github.com/annamarchenkova/telegram-analyser — one-chat dated Telethon history reader. Original example uses questionable equality-on-datetime and writes raw text.
- https://github.com/SokinjoNS/tg-message-listener-main — Telethon event listener. Example references missing handler modules and reads JSON credentials.
Our version reimplements the narrowly needed functions and never imports either codebase.

## Privacy / research contract
- **Owner history:** explicit `--chats` allowlist, bounded to 1–90 days and a fixed maximum per chat. No all-chat sweep, no joining groups, no posting messages.
- **Owner live:** listen only to those selected chats while a trusted local worker is connected.
- **Bot inbox:** only private messages/forwards from the explicitly allowlisted Telegram user ID; no attempt to retrieve other Telegram conversations.
- **Data minimization:** captures contract candidates, message event and collection UTC timestamps, non-authoritative migration/pool/rug *claims* and HMAC-based message fingerprints. It does **not** persist raw message content, sender names, phone numbers or Telegram chat IDs.
- Captured `0x...` contract is `evm_unresolved` until specific blockchain identity is verified. `...pump` is a Solana address candidate, not a proven mint.
- These records have `migration_verified_onchain=false`, `scoring_eligible=false`, and `can_authorize_trade=false`. No retrospective claims may be promoted into forward prediction scores.
- **Secrets must stay local:** Telegram session files are authorization credentials. Never upload `*.session`, bot tokens, API hash, code, 2FA password, or raw Telegram exports to a public repository, Colab notebook, or shared Drive. Store at rest on a trusted owner-controlled host.
- Source messages in private communities should not be redistributed. Derived metadata remains private by default and should be reviewed before any encrypted offsite archive.

## Option A: existing Telegram chat history (owner's trusted Mac)

1. On the Mac, obtain API ID and hash from https://my.telegram.org (API Development Tools) in a private browser.
2. Open a terminal in the project repo; run a locally installed Python 3.11+ and Telethon 1.45.0 using a virtual environment.
3. Set environment variables **locally** using secret management; do not enter them in ChatGPT, commit them, or paste them in screenshots:
   - `TELEGRAM_API_ID` = your app ID
   - `TELEGRAM_API_HASH` = your app hash
   - `TELEGRAM_HMAC_KEY` = privately generated 32+ random bytes, e.g. locally `python3 -c "import secrets; print(secrets.token_hex(32))"`
4. Run `python scripts/shark-telegram/telegram_intake.py backfill --chats @your_authorized_channel --days 30`.
5. Enter Telegram sign-in code / 2FA only at that machine's terminal when Telethon asks. Session and derived records stay under `~/.local/share/jhadina-telegram/`; directory is permissions 0700, JSONL records 0600.
6. For new messages in only that channel, run `python scripts/shark-telegram/telegram_intake.py live --chats @your_authorized_channel` on an approved *existing trusted worker*. It runs only while the worker process remains online. No automatic background run is installed.
7. Session revoke: Telegram > Settings > Devices > terminate that authorization. Delete local session storage if discontinuing the reader.

## Option B: forward-to-bot inbox (simpler from iPhone)

1. On Telegram, open official `@BotFather`, create your private research bot with `/newbot`, save the bot token **only on the trusted worker**. A bot sees messages sent or forwarded directly to it, not pre-existing old message history in arbitrary chats.
2. In a local shell securely set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID` (your numeric Telegram account ID), and `TELEGRAM_HMAC_KEY`. Verify the owner ID locally; do not enable arbitrary senders. Never relay bot token or login codes to ChatGPT.
3. Run `python scripts/shark-telegram/telegram_intake.py forwarded-bot`. Forward selected token/migration messages to the bot from your iPhone. Restricted-forwarding messages may not be forwardable; respect chat restrictions.
4. The bot **only receives** and parses forwarded text/captions from that owner ID, writes private derived rows locally, and checkpoints Telegram updates. It never responds, posts, buys tokens, or retrieves old chats by itself.

### Install and limits
```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r scripts/shark-telegram/requirements.txt
```

This is an ingestion stage only. Next add strict per-token lifecycle and on-chain Pump.fun/PumpSwap migration cross-checks, reliable de-duplication across replay/live overlap, policy-approved encrypted Google Drive backup, and forward prediction/graded outcome linkage. Supabase currently read-only; no runtime database ingestion or actual Jhadina memory promotion is claimed. Historical original SHADOW ledger remains unrecovered.
