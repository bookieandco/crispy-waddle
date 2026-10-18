# Jhadina SHARK Telegram one-shot research preview

**Status:** owner allowlist and read-only inbox authentication previously verified.
This is **not** an always-on Telegram bot or an approved trading agent.

## Use from an iPhone

1. Open the existing authorized bot: https://t.me/R2dice2bot
2. Either **forward** a non-sensitive token message into the bot, OR type
   one of these commands directly in the bot chat (no forwarding required):
   - `/research-token So11111111111111111111111111111111111111112` — the
     official Wrapped SOL (WSOL) native mint, suitable for **testing extraction**.
     It is a known reference asset and **must not be called a new launch or alpha**.
   - `/research-token <your public token contract address>` — a Solana-format
     or EVM-format candidate you have permission to share.
   - `/research-note CA <public contract address> migration claim` — optionally
     type your own non-sensitive research note. Do not transcribe protected posts.
3. After the submission, send this **fresh, direct** message (do not
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
- Only messages **forwarded by the same owner** or explicit, unedited direct
  `/research-token` and `/research-note` submissions from that owner, sent
  before the digest command within six hours, are considered. Arbitrary text,
  group messages and any other sender are ignored.
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
- Directly submitted and forwarded candidates are **unverified**, and manual
  submissions are not evidence that the owner saw an earlier public prediction.
- Candidate token addresses appear **only in a protected private Telegram reply**
  to the allowlisted owner. They are not added to SHARK's production database or
  scored. This preview has **no durable memory** and can't learn across runs.
- No third-party services or paid Railway projects are created.

## Known-reference screening (TELEGRAM-ALPHA.02)

The one-shot preview uses an **exact-match, static** reference table for two
Solana native mints: Token Program WSOL
(`So11111111111111111111111111111111111111112`) and Token-2022 WSOL
(`9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP`). The source of
these two identities is the [official Solana Sync Native documentation](https://solana.com/docs/tokens/basics/sync-native).

- The private report still counts these addresses for **connectivity-test
  visibility**, but labels them `KNOWN_REFERENCE_ASSET`, **not new-launch leads**.
- Other Solana-looking addresses are `FORMAT_ONLY`, not proven to exist or to
  be newly launched; EVM-looking addresses are `NETWORK_UNRESOLVED`.
- Reference mints appear **after** other unknown format-only mentions in the
  limited five-item digest, so repeated test messages cannot dominate the view.
- Neither unknown nor known addresses receive automated admission, persistent
  scoring, market verification, SHARK model learning, or trade authority.
- A claim that WSOL \"migrated\" or \"rugged\" remains an unverified text claim,
  **never** an override of the exact reference identity.
- The full result is *not available* from GitHub Actions logs; owner-only private
  output is intentionally not retained by the workflow.
- Do not ingest Telegram API content into an AI/ML training or deployment path.
  Telegram's [API terms, section 1.5](https://core.telegram.org/api/terms)
  restrict this use; any future ingestion scope requires a separate rights and
  consent review. Independently sourced public chain/market observations may be
  studied only under their own source terms, without joining disallowed private
  Telegram message data into model training.

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
