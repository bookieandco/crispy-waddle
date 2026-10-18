# TELEGRAM-ALPHA.07 — public canary and external listener reconciliation

## What was verified

- GitHub source inspected: `incodellc/telegram-listener`, upstream main commit `2670566a85762a639de30c186200f2dfc558e594`, originally pushed 2025-05-28.
- Implementation: Node GramJS `telegram`/`StringSession` + `NewMessage({incoming:true,chats})` + `getEntity`, sends message and chat entities to `MAKE_COM_WEBHOOK_URL` via axios. `users.js` creates/updates Airtable Users records with names, username and potentially phone, and optionally downloads photos to Cloudinary.
- The `chats` array is an empty TODO and no comprehensive account-listener delivery test is committed. Without authenticated owner deployment no real live receipt is demonstrated.
- The `README.md` says first-run session is saved; source code comments out `client.session.save()`. Session persistence, reconnect, private scope, chat exclusions and deletion/retention behavior are not certified.
- Short text is discarded by a `<100`-character filter when `data.message.message` exists, making token-only and migration observations unreliable.
- README and `package.json` say MIT; a stand-alone LICENSE file was not visible in the repository root. Treat license evidence as a review item before any code copying; none was copied.
- Docker uses node:18.20, installs dependency tree and passes all `.env` variables into a long-running container. No host, port or webhook enabled by this reconciliation.

## Decision

**Reuse the event-boundary idea only; do not install/copy upstream code.** Existing draft SHARK owner-client PR #1230 already has more relevant Telethon implementation: trusted local login, owner-ID verification, private 0600 session, 0700 directory, selected-chat/all-new-chat policy, reconnect/ephemeral notices and simulated operator tests.

Upstream has no useful missing production feature warranting a second active Telegram session or a third-party PII export. Specifically do not add Make, Airtable or Cloudinary to canonical SHARK. Do not pipe Telegram raw/derived data to JLLM or any AI/ML model.

Telegram API terms section 1.5 currently prohibits obtaining/aggregating Telegram API information for training, fine-tuning, development, enhancement **or deployment** of AI/ML systems. Terms: https://core.telegram.org/api/terms . Treat this as an independent product/legal release constraint, not a feature to bypass. A non-AI, ephemeral read-only local counter remains distinct from permission to train on Telegram messages.

## Public data acceptance (new in .07)

The new `ops/meme/public_alpha_canary_once.py` only accepts an owner-typed public Solana mint and literal `PUBLIC-MARKET-ONLY` confirmation. It composes existing ALPHA.03 public RPC/DEX read code, verifies the conservative public research schema and reports **redacted health labels only**. A successful observation remains `PUBLIC_MARKET_PARTIAL_NOT_ALPHA`; an official WSOL native reference remains `KNOWN_REFERENCE_MINT_TEST_ONLY`; missing/invalid evidence is quarantined. No archive, Telegram, AI, wallet, trades, or account credentials.

New workflow `.github/workflows/jhadina-shark-public-market-canary.yml` is **manual, trusted-main only** (`workflow_dispatch`) with read-only repo permission and no secrets. It accepts a single public mint, performs source-only tests, then a bounded public endpoint read. It prints only status booleans, never raw RPC bodies, mint address, chat contents or identifiable Telegram data. PR/push builds cannot perform the live read. No budgeted third-party services or scheduled workers.

### iPhone run path after merge (not live yet)

1. Open the GitHub Actions workflow: https://github.com/bookieandco/crispy-waddle/actions/workflows/jhadina-shark-public-market-canary.yml
2. Select **Run workflow** on `main` and enter one *public token mint*; never paste an API key, session, secret, personal message or private wallet key.
3. Enter `PUBLIC-MARKET-ONLY` under confirmation. A reference WSOL address can test connectivity but cannot create a paper-alpha case.
4. Review result labels in the job. Passing transport/readiness is **not** an independent on-chain provenance signature or verified trade result. This workflow intentionally saves no token data, so it does not create an ALPHA.04 study automatically.

### Code-only tests

```sh
python3 -m unittest discover -s ops/meme -p 'test_public_alpha_canary_once.py' -v
```

## Release boundary

- PRs #1365, #1366, #1367 and #1368 remain draft, unmerged ancestors to this branch. Review and land in order; CI success does not bypass owner-device or production acceptance.
- Real-world live provider output is not yet certified here. GitHub and iPhone acceptance remain pending.
- Telegram reader #1230 / issue #1238: genuine owner-device session/login, consent, opt-in scope and platform terms remain blocking. Do not assume the Bot API proves personal-account access.
- Keep Supabase as a separate later audit/repair; no persistence schema or writes are authorized by ALPHA.07.
- No source-learning, performance promises, financial orders, wallet signing, unattended Telegram message scanning, or autonomous trade authority.

## Next

After exact-head CI and operator acceptance, capture separately permitted public observations prospectively and grade conservative price-only outcomes; no retroactive Telegram early-call claims.
