# SHARK host quote timing — research-only (2026-10-24)

An opt-in, GET-only Jupiter transport probe, **not** a SHARK Money engine, wallet connector, signer, order path, Telegram listener or autonomous scheduler.

## Offline certification
From scripts/shark-sniper run:
    python3 -m unittest -v test_quote_probe.py
The five tests never access a provider.

## Authorized read-only host smoke
After a separate isolated SHARK worker has explicit deployment/cost approval, from this folder run:
    python3 quote_probe.py --approve-read-only --samples 4

Defaults are SOL/USDC: infrastructure baseline, NOT a launch cohort or memecoin. The script submits real forward and hypothetical reverse read-only quote GET requests to one fixed HTTPS origin, enforces exact mint/amount, nonempty route and context-slot checks, rejects redirects, uses 128 KiB max response, permits only 1–100 samples and paces requests at 2.5 seconds or slower for the public keyless rate limit. No wallet address, signer, Telegram data, POST, trade or funds are involved. Re-read provider rules before a long run.

Its JSONL summary reports provider request p50/p95/p99, failures and total pair wall time **including intentional rate pacing**. Reverse input is *hypothetical forward quote output*, not an actually purchased or held position. Price/route observations do NOT establish fillability, fees, profit, MEV or an actual exit. A transport error, missing route or rate limit is NO_QUOTE, never success.

## Release evidence before numerical deadlines
1. Certified isolated worker ID, region, code SHA, provider API, host timestamp accuracy, URL rules and prospective collection bounds.
2. At least 100 completed independent two-sided quote pairs plus ALL failures, stale samples, p50/p95/p99 and clock/resumption tests; report how the keyless pacing constrains these results.
3. Separate real 24–30h canonical SHARK launch cohort preserving ALL discovered/expired/rejected candidates with source timestamps, genuine risk checks, quote ages and independent sell-route observations.
4. Only then suggest per-hop deadlines from observed p99 plus measured jitter, without lengthening stale-source TTLs or treating provider roundtrips as event-to-exit speed. Failing deadlines must fail closed into NO_TRADE, not fake fills. Approve any calibration changes independently.
5. Wallet signing, funding, spending, listener activation and production deployment remain OFF.

## Verified infrastructure status
As of October 24, Railway Jhadina Telegram Cloud staging has only the held jhadina-telegram-owner-listener service and a 512 MB mounted volume. Its successful October 23 deployment only proves that disabled Telegram worker started. It is **not** a commissioned quote sampler. This branch never deploys to Railway or modifies production.

Sources: https://docs.dexscreener.com/api/reference and https://developers.jup.ag/changelog/developer-platform.
