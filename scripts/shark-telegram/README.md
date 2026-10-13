# SHARK Telegram message reader — research only

## Status (2026-10-12; @R2dice2bot owner-named)
Code staged in draft SHARK training PR; the **Bot API owner identity has been verified**, but the separate **personal user-account Telethon session has NOT been connected**, live monitoring has not run, and no personal-account data has been collected or deployed. No Telegram subscription is required. No Telegram OAuth/session keys are held by ChatGPT or GitHub.

Design references (not embedded dependencies):
- https://github.com/annamarchenkova/telegram-analyser — one-chat dated Telethon history reader. Original example uses questionable equality-on-datetime and writes raw text.
- https://github.com/SokinjoNS/tg-message-listener-main — Telethon event listener. Example references missing handler modules and reads JSON credentials.
Our version reimplements the narrowly needed functions and never imports either codebase.

## Privacy / research contract
- **Owner history:** explicit `--chats` allowlist, bounded to 1–90 days and a fixed maximum per chat. No all-chat sweep, no joining groups, no posting messages.
- **Owner live:** either explicitly selected chats (`--chats`) or **all new incoming Telegram cloud conversations** (`--all-chats`), only after explicit owner opt-in. All-chat mode allows `--exclude-chats` to deny known peers, and automatically includes newly joined channels/new private chats. The listener receives text from Telegram only while a trusted local worker is connected; **no all-chat history backfill** is allowed.
- **Verified personal account:** user-session readers (both live and limited backfill) require `TELEGRAM_ALLOWED_USER_ID` set locally, matching the independently verified bot owner. A mismatched Telegram login is rejected.
- **Bot inbox:** only private messages/forwards from the explicitly allowlisted Telegram user ID; no attempt to retrieve other Telegram conversations.
- **Data minimization:** selected-chat research paths can produce pseudonymous contract and unverified-claim evidence, but require a separate Telegram API terms/compliance review before activation or use in AI training. The **all-new-chats** listener uses **ephemeral, deterministic regex counts only**, with no storage of messages or derived events; neither path may feed AI/ML training without appropriate authorization. It does not persist raw message content, sender names, phone numbers or Telegram chat IDs in this all-chats scope.
- Captured `0x...` contract is `evm_unresolved` until specific blockchain identity is verified. `...pump` is a Solana address candidate, not a proven mint.
- Any records in the **separate selected-chat draft research path** have `migration_verified_onchain=false`, `scoring_eligible=false`, and `can_authorize_trade=false`. No retrospective claims may be promoted into forward prediction scores. They are not produced by all-new-chats mode.
- **Secrets must stay local:** Telegram session files are authorization credentials. Never upload `*.session`, bot tokens, API hash, code, 2FA password, or raw Telegram exports to a public repository, Colab notebook, or shared Drive. Store at rest on a trusted owner-controlled host.
- Source messages in private communities should not be redistributed. Derived metadata remains private by default and should be reviewed before any encrypted offsite archive.

## Option A: existing Telegram chat history (owner's trusted Mac)

1. On the Mac, obtain API ID and hash from https://my.telegram.org (API Development Tools) in a private browser.
2. Open a terminal in the project repo; run a locally installed Python 3.11+ and Telethon 1.45.0 using a virtual environment.
3. Set environment variables **locally** using secret management; do not enter them in ChatGPT, commit them, or paste them in screenshots:
   - `TELEGRAM_API_ID` = your app ID
   - `TELEGRAM_API_HASH` = your app hash
   - `TELEGRAM_HMAC_KEY` = privately generated 32+ random bytes, e.g. locally `python3 -c "import secrets; print(secrets.token_hex(32))"`
   - `TELEGRAM_ALLOWED_USER_ID` = your numeric personal account ID already verified with `@R2dice2bot`; the GitHub Actions secret does **not** automatically appear on your Mac.
4. Run `python scripts/shark-telegram/telegram_intake.py backfill --chats @your_authorized_channel --days 30`.
5. Enter Telegram sign-in code / 2FA only at that machine's terminal when Telethon asks. Session and derived records stay under `~/.local/share/jhadina-telegram/`; directory is permissions 0700, JSONL records 0600.
6. For new messages in only that channel, run `python scripts/shark-telegram/telegram_intake.py live --chats @your_authorized_channel` on an approved *existing trusted worker*. It runs only while the worker process remains online. No automatic background run is installed.
7. For **all new crypto-related incoming messages** arriving in your own Telegram account, explicitly run `python scripts/shark-telegram/telegram_intake.py live --all-chats`. This includes channels/groups/direct messages your account receives, including new conversations joined later. Do **not** enter a bot token for this; the previously verified `@R2dice2bot` Bot API token only controls the separate bot.
8. Optionally deny known conversations by adding `--exclude-chats @private_chat @unrelated_channel` to `--all-chats`. Exclusions must resolve to known Telegram peers before monitoring begins; a failed lookup stops startup.
9. **All-chat mode is EPHEMERAL and NON-AI:** regular-expression checks count recognizable contract candidates **only in memory** and may print counts to your local terminal. It does not save raw or derived Telegram data, train SHARK, update a watchlist, emit source fingerprints, send an AI prompt, or keep training examples. Other new messages are observed and discarded. Telegram's current [API Terms](https://core.telegram.org/api/terms) prohibit using Telegram API data to train, enhance or deploy AI/ML models. Existing per-chat research persistence in this draft PR must undergo a separate compliance review and is **not** activated by all-chat mode.
10. This uses Telegram's personal-account MTProto client, not GitHub Actions. Keep your API ID/hash, OTP/2FA and `owner.session` on a trusted Mac or private persistent host. **Never** put the user session into GitHub Actions, Google Drive, Vercel builds or the public repository. The code refuses personal sessions in CI/Vercel.
11. This is **live-only**: a stopped or sleeping laptop can miss events. Backfilling all chats is deliberately disabled, even if you opt into all new messages.
12. Session revoke: Telegram > Settings > Devices > terminate that authorization. Delete local session storage if discontinuing the reader.

## Option B: forward-to-bot inbox — @R2dice2bot (simpler from iPhone)

**Owner-named bot:** https://t.me/R2dice2bot ; intended bot username is hard-pinned in `telegram_intake.py`.
The user already has the bot token. **Do not create another bot, paste the token into a GitHub file, or share it in ChatGPT.**

1. Open `@R2dice2bot` on your iPhone, tap **Start**, and keep the bot token in a secure local secret store on your Mac or approved host. Opening Telegram alone does not turn on our uncommissioned reader.
2. On the trusted worker install dependencies (below) and securely set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_HMAC_KEY` (private random 32+ bytes). Run `python scripts/shark-telegram/telegram_intake.py pair-owner` when no other polling listener is running. This verifies via Telegram's `getMe` that the token identifies **@R2dice2bot**, and via `getWebhookInfo` that an existing webhook would not be interrupted.
3. The terminal prints a one-time `/pair <random-challenge>` command. Send it from your own Telegram account in your direct chat with `@R2dice2bot` within three minutes. This saves **only your numeric Telegram ID** to a private local file (0600). No other sender gets paired unless they know the random challenge; never post that challenge publicly.
4. Run `python scripts/shark-telegram/telegram_intake.py forwarded-bot` on the same trusted machine or set `TELEGRAM_ALLOWED_USER_ID` with the paired numeric ID on your approved deployment host. The bot accepts only your private messages/forwards, parses contract and migration **claims**, and writes derived metadata.
5. From your iPhone, forward a non-sensitive token message or paste one of your research contract addresses to the bot. The worker will log the *count* of recognized mentions, not the message body. Inspect local `forwarded-derived-signals.jsonl` for an explicit research-only record.
6. A Telegram bot **does not automatically read old messages in your other private chats**. Use the separately authorized owner Telethon reader (Option A) for chosen historical conversations. Respect group/channel restrictions on forwarding.

**Existing bot safeguards:** If `@R2dice2bot` already powers another integration, **do not run two long-polling consumers** against it. The new reader refuses to overwrite an active Telegram webhook and does not delete any existing webhook or start chats itself. A separate bot may be appropriate for production if you need both functions running simultaneously.

**Railway deployment:** Existing Railway projects are OverageOS and PupsonStuff; the reader has not been added to either. After you pair your ID, use a dedicated worker process with the intended GitHub branch/merged code, `python scripts/shark-telegram/telegram_intake.py forwarded-bot`, and Railway's private variables `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HMAC_KEY`, `TELEGRAM_ALLOWED_USER_ID`. Mount durable storage and set `TELEGRAM_PRIVATE_DIR` to its mount path; without a volume, restart would lose records and update checkpoints. Run exactly one replica. Service and persistent storage may incur charges; this runbook does not create them.

## Link to SHARK's watchlist review queue

After an authorized backfill or bot-forward session, run:

```bash
python scripts/shark-telegram/telegram_intake.py export
```

This creates a **local private** `~/.local/share/jhadina-telegram/telegram-watchlist-candidates.json` with one record per network/address, distinct message counts, timestamps and claimed migration counts. It deduplicates repeated versions by keyed HMAC and reports **separately**: initial new-message migration claims, subsequent edited-message migration claims, and the **latest known historical snapshot** (which cannot establish the original text at posting time). `first_detected_utc` is collection availability and is not a backdated prediction. Telegram's `getUpdates` queue retains undelivered messages for no longer than **24 hours**; historical scans use the separately authorized Telethon account. Every token remains `approved_for_market_collection=false`, meaning **no chat rumor is automatically admitted to Jhadina training or trading**. Review and approve candidate contracts separately, then supply only approved addresses to the market snapshot collector. Do not upload private Telegram chat text or session files to Google Drive/Colab.

### Migration review queue — no on-chain verification implied

Run:

```bash
python scripts/shark-telegram/telegram_intake.py migration-review
```

Produces a second **private** `~/.local/share/jhadina-telegram/telegram-migration-review-queue.json` with candidate Solana contracts, separate original/edit/backfill migration *claim* counts, and explicit requirements for actual Pump/PumpSwap migration proof. For EVM candidates, it first requires identifying the real chain. All cases are `PENDING_*`, unverified, unscored and prohibited from trade execution. The review generator makes **zero** chain-provider requests.

`edited_message` Bot API updates and Telethon `MessageEdited` events are recorded as **append-only versions** with the original send time, edit time, and first accessible collection time; rewording a message later never upgrades an initial call. Telegram deletion notices are not complete and this pipeline does not claim full deletion tracking. Messages forwarded from elsewhere inherit the **bot inbox receipt** as observed source availability, not the forwarded channel's old timestamp.

### Install and limits
```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r scripts/shark-telegram/requirements.txt
```

This is an ingestion stage only. Next add strict per-token lifecycle and on-chain Pump.fun/PumpSwap migration cross-checks, reliable de-duplication across replay/live overlap, policy-approved encrypted Google Drive backup, and forward prediction/graded outcome linkage. Supabase currently read-only; no runtime database ingestion or actual Jhadina memory promotion is claimed. Historical original SHADOW ledger remains unrecovered.
