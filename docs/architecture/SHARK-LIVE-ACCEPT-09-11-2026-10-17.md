# SHARK-LIVE.ACCEPT.09 → .11 — real public worker one-shot, zero host provisioning

**Status:** Source-only until merged. Production SHARK-LIVE remains **NOT COMMISSIONED**.

## Existing implementation reused
- `ops/meme/shark_live_intelligence.py` — the canonical first-observation/DexScreener/RPC paper monitor.
- `ops/meme/shark_ephemeral_once.py` — strict, redacted manual-acceptance harness. Does not add a second data collector.
- `.github/workflows/shark-live-public-once.yml` — separate, `workflow_dispatch`-ONLY, trusted-`main` run. No cron, no Telegram bot secrets, no uploads, no model calls, no wallet, no trading.

## .09 — Fail-closed public provider first read
Only if an owner explicitly types `PUBLIC-SHARK-ONCE-NO-TRADES`, GitHub's throwaway runner launches exactly one canonical `--mode once` public-market cycle. It queries existing fixed public DexScreener feeds and bounded Solana RPC/DEX account/mint evidence; actual endpoints, rate limits and timestamps remain unverified until the real workflow is run. Time limit 115 seconds for the child and 145 seconds externally, with an ephemeral 0700 temporary directory.

## .10 — Redacted actual-worker evidence
The harness accepts the exact SHARK-LIVE worker schema only when no trade, wallet, Telegram-message processing, alerts, AI training or source attestation is claimed. The output contains only counts: newly observed public mint candidates, RPC/DEX checked, quarantined, fresh prospective **unscored** paper cases, and elapsed total request-cycle seconds. No raw provider body, mint, chat, bot recipient, token price or private key is printed.

**Possible outcomes:**
- `PARTIAL_PUBLIC_RESEARCH_RECEIVED_NOT_ALPHA` (exit 0): some fresh usable public observation was found. **Not** verified source provenance, alpha, sellability or future predicted returns.
- `INCONCLUSIVE_NO_USABLE_PUBLIC_RESEARCH` (exit 2): feeds were empty or all sampled dossiers were quarantined, so no success is claimed.
- `PUBLIC_PROVIDER_NOT_VERIFIED_FAIL_CLOSED` (exit 1): authentication/HTTP/timeout/contract errors or response invalidity; no secrets or raw provider error strings reproduced.

The transient SQLite evidence is deleted automatically when the command exits. Running again is a **new** first observation, not 24–30-hour continuous follow-up, durable analytics or a trained alpha engine.

## .11 — Real operator commissioning remains distinct
Once merged, an owner can use the GitHub Actions **SHARK Live Public Worker One-Shot** workflow on `main`, with the exact consent phrase. It requires no public mint input because it tests the existing public feed discovery → risk-check pipeline end-to-end. The workflow's successful completion certifies only *a specific ephemeral public-provider acceptance run*. It does **not** certify a continuously running host, off-host backup, provider-independent signatures, owner Telegram receipt, or profit.

Release gates for continuous work remain in [issue #1374](https://github.com/bookieandco/crispy-waddle/issues/1374): isolated owner-approved persistent host and budget, provider-rate and clock evidence, proper encrypted off-host backup/recovery, a later prospective 24–30h paper observation, and explicit owner-private alert readback. No auto-trading or Telegram-derived AI/ML.
