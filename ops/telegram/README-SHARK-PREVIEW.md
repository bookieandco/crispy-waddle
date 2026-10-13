# Jhadina SHARK Telegram one-shot research preview

**Status:** owner allowlist and read-only inbox authentication previously verified.
This is **not** an always-on Telegram bot or an approved trading agent.

## Use from an iPhone

1. Open the existing authorized bot: https://t.me/R2dice2bot
2. From Telegram, **forward** one or more token call/channel messages into that
   *private* conversation. You do not have to create another bot.
3. After forwarding those messages, send this **fresh, direct** message (do not
   forward the command): `/research-digest JHADINA-SHARK-06`
4. Within **15 minutes**, open
   https://github.com/bookieandco/crispy-waddle/actions/workflows/jhadina-telegram-shark-research.yml
   and select **Run workflow**, branch `main`, tag `JHADINA-SHARK-06`.
5. If the workflow succeeds, the existing bot sends a **private text report**
   to the Telegram account whose ID matches the repository's
   `TELEGRAM_ALLOWED_USER_ID` Actions secret. GitHub logs show only success or
   safe error labels. They do not show Telegram IDs, forwarded text, or tokens.

## Strict safeguards

- A valid **exact fresh** command from the allowlisted Telegram user, with
  `from.id == chat.id == TELEGRAM_ALLOWED_USER_ID`, is mandatory before any
  private report. A group, forwarded command, edited command or unpaired user
  cannot authorize the run.
- Only Telegram messages **forwarded by the same owner** before the command,
  within the previous six hours, are considered.
- The one-shot Telegram Bot API call is `getUpdates` with `offset: 0`,
  `limit: 100` and `timeout: 0`. It **does not acknowledge or remove**
  pending updates. Old updates expire in Telegram; this process does not restore
  deleted/unavailable historical posts. If there are over 100 outstanding
  updates, newest forwards may not be present. This one-shot cannot solve
  that; a durable queue consumer is a separate commissioning step.
- An existing webhook or competing poller fails closed.
- Token formats are **candidates**, not proof of mint identity, a particular
  EVM chain, graduation, a real pool, liquidity, token safety, profits, or a
  legitimate market quote.
- Migration/PumpSwap/rug flags are **claims or mentions in the forwarded text**,
  not independent on-chain confirmation.
- Historical source timestamps are never treated as proof that a prediction was
  published, collected or available before the market outcome. The inbox
  envelope is the earliest availability visible to this workflow.
- No raw message contents, source/channel names, sender IDs, derived signal
  JSONL, watchlist, private reports, workflow artifacts, or trading instructions
  are committed, cached, uploaded, or printed by this workflow.
- Candidate token addresses appear **only in a protected private Telegram reply**
  to the allowlisted owner. They are not added to SHARK's production database or
  scored. This preview has **no durable memory** and can't learn across runs.
- No third-party services or paid Railway projects are created.

## What is deliberately still missing

This is a narrow privacy-safe preview, not production SHARK ingestion. Real
learning requires the separately drafted reader and SHARK adapter in
[PR #1230](https://github.com/bookieandco/crispy-waddle/pull/1230), a securely
held persistent HMAC key, durable private storage, deduped immutable source and
revision receipts, on-chain evidence/provider verification, and real forward
performance scoring. Those features are **not** activated by this workflow.

In production the worker must acknowledge each Telegram update only after its
derived evidence is durably persisted, and recover safely from crashes/replays.
Do not enable trading without a separate owner-approved design and independent
policy and legality checks.
