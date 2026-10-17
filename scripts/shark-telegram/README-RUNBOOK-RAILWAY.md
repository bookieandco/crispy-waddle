# @R2dice2bot — operator's guarded Railway deployment guide

Status: staged code **only**, no infrastructure provisioned or running. GitHub source: `bookieandco/crispy-waddle`, branch `feat/shark-memecoin-research-training-20261012`. The PR is a draft; don't treat it as a published stable release.

## Required approvals and provisioning

1. Review the code and [PR #1230](https://github.com/bookieandco/crispy-waddle/pull/1230). Use a **dedicated Railway project/service**, not existing OverageOS/PupsonStuff workloads.
2. Railway source: `bookieandco/crispy-waddle`; **root directory** `/scripts/shark-telegram`; builder: `DOCKERFILE`; path `Dockerfile`; command: `python -u telegram_intake.py forwarded-bot`. This worker **does not** need a public domain or inbound port.
3. Attach a **persistent Railway volume** at `/data` and set `TELEGRAM_PRIVATE_DIR=/data/jhadina-telegram`. The worker fails closed on Railway if `RAILWAY_VOLUME_MOUNT_PATH` is absent or the output directory is outside that mount. One replica, one region; do not scale the bot worker horizontally.
4. Privately enter the following variables into Railway. Never send them to this chat or GitHub and never include their values in the PR:
   - `TELEGRAM_BOT_TOKEN` — from the existing `@R2dice2bot` BotFather conversation.
   - `TELEGRAM_ALLOWED_USER_ID` — numeric owner ID obtained through the trusted-local `pair-owner` command or otherwise independently verified. Do not guess.
   - `TELEGRAM_HMAC_KEY` — dedicated 32+ byte random private value; keep stable across restarts, or dedup fingerprints will change.
   - `TELEGRAM_PRIVATE_DIR=/data/jhadina-telegram`
5. Do **not** run `pair-owner` simultaneously with `forwarded-bot`: both use Telegram's single `getUpdates` queue. Run local pairing before worker deployment, or supply an independently verified numeric Telegram owner ID. A previously registered webhook causes startup refusal rather than being deleted.
6. The bot's identity preflight checks official `getMe` matches `@R2dice2bot` and `getWebhookInfo` has no active URL. HTTP 409 conflicts cause the worker to stop rather than fight an existing polling consumer.
7. Deployment completion requires a terminal Railway SUCCESS state and logs showing `TELEGRAM_EXPECTED_BOT_VERIFIED @R2dice2bot` followed by `OWNER_ONLY_FORWARD_INBOX_ACTIVE`. Those logs **are not** proof of receiving a real Telegram message.
8. From the authorized Telegram account, open https://t.me/R2dice2bot and send/forward a non-sensitive sample containing a tracked address and migration mention. Look for `NEW_TOKEN_MENTIONS 1`. Confirm the private volume contains a derived signal record whose `scoring_eligible` and `can_authorize_trade` are false.
9. Restart the worker and verify the same volume and `forwarded-update-offset.txt` survive. Run `python telegram_intake.py export` and `python telegram_intake.py migration-review` on the trusted host to produce the deduplicated research watchlist. Never promote an unapproved token into live signals or trades without independent chain review.
10. To stop: disable the service, revoke its BotFather token if compromised (rotate secret safely), and preserve the encrypted owner-controlled metadata archive. No existing SHADOW historical ledger is restored or overwritten by these new files.

### Known limits

- A Telegram **Bot API key only authorizes this one bot**, not all chat history from the owner's Telegram account. Historical reading of authorized selected chats requires separate local Telethon API ID/hash and login.
- Private forwarded text is converted to minimal metadata. `message_time_utc` is Telegram's envelope timestamp when the bot got the forward; `forward_origin_date_utc` when present is a separately tagged source timestamp, not proof of market availability.
- SHARK's existing `external-signal-ingest.ts` already accepts Telegram research evidence; this worker currently writes private JSONL locally and does not call the production adapter or database. Supabase's last observed read-only block must be resolved before durable database ingestion.
- Railway billing, configured service and volume, Telegram identity credentials, and actual live incoming signals have **not** been commissioned in this PR.

## Latest chronology and source-learning rules

- Unknown forwarded original channels **must not** be grouped as one historical caller. Each unattributed message receives its own provisional source pseudonym. A known forwarded upstream channel can have a keyed pseudonym only when Telegram exposes its numeric ID.
- The adapter keys distinct edited versions with content HMAC and edit UTC date, preventing an edited migration claim from overwriting the earlier immutable observation. Historical `backfill` is a snapshot of currently accessible text; it is **not** evidence of the exact text when first posted.
- Telegram Bot API pending updates expire within 24 hours, so never claim a bot reconnect restores older private-chat history. Owner-authorized Telethon backfill is a separate local action with explicit chat allowlisting. Source: https://core.telegram.org/bots/api#getting-updates
- Migration-review output is a **checklist** of claimed Pump/PumpSwap graduation from Telegram messages; the independent canonical Pump program, base/quote mints, pool, transaction/discriminator, and actual curve completion must be checked before any on-chain truth promotion.
