# TELEGRAM-LISTENER.RECOVER.01 → .08
**Source-only recovery, 2026-10-21. Branch based on main 04e96506.**

## Evidence and preserved systems

- Canonical Bot API owner: ops/telegram/bot_research_once.py, public-market manual workflow and past verified @R2dice2bot private delivery. Unchanged. No new bot consumer is launched.
- Personal Telethon client and research bridge selectively copied from draft PR #1230 head af8c228d; that PR had diverged from main by 908 behind and 86 ahead. This is NOT a bulk merge and does not modify the original draft.
- Existing SHARK/Shadow/Money/Purse, private one-shot bot, Supabase architecture and source-only market research are left intact. No new paid service, database, wallet, API credentials or deployment.

## Stage-by-stage recovery ledger

| Stage | Implemented in this source branch | Still blocked or deliberately inactive |
| --- | --- | --- |
| .01 Reconcile | Selected personal listener, trusted local launch utility, privacy guards and tests recovered on current main base | Review stale #1230 and current head CI before merge |
| .02 One consumer | Persistent forwarded-bot entrypoint hard-stops; the verified main one-shot keeps Bot API getUpdates ownership | Shared durable consumer design and external approval; no competing polling |
| .03 Delivery | Local SQLite update metadata ledger atomically persists update ID, HMAC, disposition and monotonic offset, with duplicate/quarantine/gap tests | Dormant module, not a live bot service; no real updates read or acknowledged |
| .04 Attribution | Selected chat metadata persistence held by code until rights review; ephemeral all-chat regex, message/edit claim attribution and conservative source chronology preserved | No Telegram-derived AI/ML training, automatic market scans or permanent private-data archive |
| .05 Trusted device | User-session identity, ownership, symlink/0600 checks, bounded reconnect, local diagnostics, synthetic incoming-event tests and failing production release gate | Trusted-owner Mac login, fresh actual event, sleep/reconnect, revocation and terms review unverified (issue #1238) |
| .06 SHARK reuse | Existing typed Telegram-derived evidence-only adapter selectively recovered, original SHARK market/oracle modules untouched | No permitted Telegram-derived model ingestion |
| .07 Shadow/Purse boundary | Adapter maps candidates to untrusted EVIDENCE_ONLY observations with canAuthorizeTrade=false; no wallet, trade or self-funding code imported | No end-to-end operational downstream handoff until independent public-chain and compliance certification |
| .08 Latency | Synthetic per-stage p50/p95/p99 audit with bounded sample counts and explicit cannot-certify-live guard | No verified 600ms production result, 24/7 uptime, host, actual Telegram timestamps or RPC/quote timing |

## Offline acceptance

    python3 -m compileall -q scripts/shark-telegram
    python3 -m unittest discover -s scripts/shark-telegram -p 'test_*.py' -v
    python3 scripts/shark-telegram/personal_release_gate.py --mode ci

Production admission must return code 1, even when source tests pass:

    python3 scripts/shark-telegram/personal_release_gate.py --mode release

The GitHub Actions workflow telegram-listener-recovery.yml verifies the source gate and the SHARK TypeScript research bridge without Telegram secrets.

## Trusted device remains a separate real-world dependency

Issue #1238 requires owner-controlled Telegram app login on a trusted Mac; never paste app ID/hash, 2FA codes, Telegram session, private chats, chat IDs, keys or screenshots revealing secrets into GitHub/ChatGPT/Drive. Independently match the owner Telegram user ID; record only redacted PASS/FAIL for new-message delivery, excluded chats, restart, sleep and session revocation. Foreground iPhone terminals are not reliable always-on workers.

The current personal all-new-chats path performs in-memory, non-AI regex counts; it does not export message data. Selected chat history research and private metadata storage remain held for Telegram API rights review. A later owner approval must not be converted into an undocumented production switch. Telegram API terms constrain use of data for AI/ML; independently sourced public-chain study should stay separate.

## Latency/production acceptance

For a genuine latency result, collect independent host and provider timestamp provenance, same-clock monotonic processing spans, stage breakdown, gap/duplicate counts, exclusions, reconnect and queue-lag evidence on an approved runtime. Require p50/p95/p99 and sample size, and distinguish local handler speed from chain discovery and public executable quotes. The synthetic harness is explicitly not proof of the previously discussed 0.6-second discovery target.

**No merge, deployment, paid infrastructure, owner session, Telegram source learning, financial orders, wallet signing or trading are authorized by this source-only recovery.**
