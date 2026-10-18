# SHARK-LIVE.INTELLIGENCE.01 → .05 — public research worker handoff

**Date:** 2026-10-17. **Implementation:** `ops/meme/shark_live_intelligence.py`.
**Status:** source-only, requires a commissioned trusted always-on host. **Not a live deployed service.**

## Architecture reconciliation

- Reuses the canonical `experiment_7day.candidates` public DexScreener token-profile/boost discovery and its fixed, free endpoints; does NOT duplicate that pilot's fixed October 20 experiment state or overwrite its data branch.
- Reuses `public_mint_dossier.manual_read_public_mint` (fixed free Solana RPC `getAccountInfo` + DexScreener eligible-pair read), including conservative Token-2022/mint/freeze control and insufficient-evidence flags.
- Reuses `public_alpha_study.start/follow/check_study` to seal only prospective, public-first-observation paper cases, later same-pool 24–30h spot-only returns or explicitly censored outcomes. No fabricated older signal timestamp.
- Reuses the canonical `bot_research_once.send_private_preview` solely to deliver *independently sourced public* research to an allowlisted Telegram user. No Telegram inbox read, no private message or account data sent to DEX/RPC, no use of Telegram-derived data in AI/ML.
- Does NOT commission draft personal Telethon reader PR #1230, the unrelated RunPod Shadow watchdog, paid services, Supabase ingress, wallet trading, source-learning, or prediction model changes.

## Bounded sequence

| Stage | Implemented boundary |
| --- | --- |
| `.01` Public discovery | Reuse public token profiles and boosts, exact Solana mint validation, native WSOL exclusion, max 2 new tokens/cycle |
| `.02` Durable public-only watch | SQLite owner-only file (0600), single local-process lock, up to 2500 active / 100000 retained public addresses, no Telegram content, no duplicate mint records, 36-hour censor/rotation |
| `.03` Rapid checks | At most 6 public mint RPC/DEX dossiers per cycle, up to 3 prioritized follow-ups, 10-min per-mint cooldown, quarantine missing/stale, actual post-request timestamp verification, no authority escalation |
| `.04` Paper signals | Prospective first public market evidence and same-pair 24–30h price-only outcomes. Case switch, missing exit and missed horizon censored. No trade entry/exit signals, fill P&L or safe-token verdict. Predeclared no-edge p=0.5 baseline Brier available only after 30 marks and >=80% price-only coverage, **descriptive**, never a calibrated executable strategy |
| `.05` Private notifications | Protected owner-only Telegram reply; disabled by default, dual opt-in CLI `--notify` and `ENABLE_SHARK_PUBLIC_ALERTS=true`, at most 2 alerts per cycle, stored claim-before-send and `UNCERTAIN_NO_RETRY` on delivery uncertainty; no alerts for unverified provider errors and no source message ingestion |

### Prospective data status and limitations

The public mint observations and their local SHA/SQLite state are **not independent cryptographic provider attestations**. Coverage is limited to DexScreener public token profile/boost feeds; it is not comprehensive coverage of all new Solana launches. RPC token-account parsing does not establish holder independence, controlling wallet clusters, LP custody, transferability, sellability or profitable execution. The first observation begins when this collector first observes the public-market data; no Telegram historical message is an early prediction.

The new-discovery budget (two per tick) is intentionally smaller than the three reserved 24-hour follow-up slots, so fresh cases do not predictably starve their own prospective outcome windows. At the fastest 120-second operator cadence this can discover at most 60 public tokens per hour; this is not comprehensive mint discovery, a guarantee of complete outcomes, or unrestricted throughput. Retained local data remains bounded; a controlled archival/retention process is required before the 100,000-record cap.

Run at most once per **120 seconds** on an authorized operator-controlled host; default 180 seconds. GitHub-hosted runners may be delayed or restarted and do not supply a durable high-speed host. This implementation does **not** claim millisecond, sub-second or even consistent 2-minute latency.

## Safe local verification

This module intentionally has no GitHub Actions schedule (the existing seven-day study already schedules public research until its cutoff). Offline checks:

```sh
python3 -m unittest discover -s ops/meme -p 'test_shark_live_intelligence.py' -v
python3 -m unittest discover -s ops/meme -p 'test_*.py' -v
python3 -m compileall -q ops/meme/shark_live_intelligence.py
```

Local audit, zero network, no personal secrets:

```sh
mkdir -p -m 700 "$HOME/.local/share/jhadina/shark-public"
python3 ops/meme/shark_live_intelligence.py --mode audit --state "$HOME/.local/share/jhadina/shark-public/observations.sqlite3"
```

Manual **public-network** single-cycle test after separate owner approval:

```sh
python3 ops/meme/shark_live_intelligence.py --mode once \
  --state "$HOME/.local/share/jhadina/shark-public/observations.sqlite3" \
  --confirm PUBLIC-MARKET-RESEARCH-ONLY
```

No Telegram send happens in that command. If a trusted host is later commissioned, an operator may set `SHARK_PUBLIC_HOST_COMMISSIONED=true` and run `--mode serve --interval-seconds 180` with the same `--confirm`, on a host with persistent private storage, stdout redaction, outbound network controls, on-call and reboot procedures. **Do not enable it merely because CI is green.** Neither a systemd unit nor a container/paid server was created.

To authorize public-data-only private notifications **after local acceptance**, the trusted operator must additionally supply `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_ID` only on that host, set `ENABLE_SHARK_PUBLIC_ALERTS=true`, and add `--notify`. Do **not** put those secrets in GitHub PR comments, terminal recordings, ChatGPT, Drive files or repo. The code never invokes Telegram `getUpdates`.

## Release gates (not met by code-only PR)

1. Exact-head offline CI and no regression to canonical seven-day/SHARK paths.
2. Real feed/RPC provider read observed under authorized source terms; actual rate-limit/backoff measurements.
3. Owner-approved persistent host with writer lock, monitored clock and durable backup/restore; verify no other collector is duplicating these specific state writes.
4. Operator opt-in to owner-private public-only notification test, plus retry/uncertain-delivery acceptance and suppression test.
5. Prospective same-pool 24–30h **real** public-only outcome and an explicit censored case; independently check time claims.
6. Account-scoped Telegram reader still blocked by PR #1230 and issue #1238. Do not use Telegram API content to train, develop, enhance or deploy AI/ML. Any privacy/legal review is separate.

**Nothing here authorizes purchases, live trades, wallet signing, on-chain transactions, real-money automation, or predictions of profitable alpha.**
