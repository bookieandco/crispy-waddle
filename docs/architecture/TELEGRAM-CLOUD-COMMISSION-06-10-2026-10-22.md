# TELEGRAM-CLOUD.COMMISSION.06 → .10
**Source and offline acceptance only — 2026-10-22. NO cloud host deployed.**

This sequence builds on the **dependent** pull requests
[#1464](https://github.com/bookieandco/crispy-waddle/pull/1464) and
[#1490](https://github.com/bookieandco/crispy-waddle/pull/1490).
It does not merge/replace them or bypass issue
[#1238](https://github.com/bookieandco/crispy-waddle/issues/1238).
All work remains Mac-independent in architecture, not live commissioned.

## .06 — Inventory and isolate the eventual host
A read-only Railway account inventory on October 22 showed two projects:
**OverageOS** (no services) and **PupsonStuff Media Services**
(with active media/remover services). Neither is a verified dedicated
Telegram host. Do not repurpose either project, create a Railway service,
assume that Railway is healthy, or pay for a plan without separate owner
authorization. No other provider account was certified for this purpose.
No direct account inspection implies a volume, durable encrypted backup,
root isolation, uptime, CPU budget or runtime health.

For a future owner-selected host, first separately obtain and verify:
dedicated account/project/workload identity; a confirmed acceptable total
cost (including private volume, network egress, backups and monitoring);
nonroot service user; SSH host key; SSH-key-only iPhone terminal access;
single replica; encrypted durable persistent block volume; full path and
permissions checks (0700 private directory, 0600 session/lock); fixed
provider/network egress policy; service restart limits and exact commit.
Shared containers, CI jobs, Vercel functions, serverless request handlers,
iPhone background terminal processes and copied session files are NOT an
approved always-on Telegram service.

## .07 — iPhone SSH enrollment, concurrency and secret hygiene
`scripts/shark-telegram/cloud_personal_listener.py enroll` now requires:
interactive SSH TTY, exact `TELEGRAM_CLOUD_ENROLL_APPROVED=YES`, a verified
dedicated mounted private folder, and exclusive runtime lock.
It **refuses an existing session** rather than silently treating it as
a new account. Phone number, OTP and 2FA are requested through hidden
private-terminal prompts. Identity must match independently verified
owner numeric ID. Provider exceptions are sanitized before reaching
service output; the client is disconnected after enrollment.

Do not paste the Telegram API hash, phone, one-time code, 2FA, or
`owner.session` into ChatGPT, GitHub Actions, public log viewers or Drive.
No enrolment has happened yet. An iPhone SSH app is a client terminal,
not the 24/7 host. Before any real owner login, operator must confirm
SSH host-key authenticity, a trusted machine/VM, permissions and
Telegram's data-use terms. If the owner ID check fails, stop, revoke the
unexpected Telegram session in Settings > Devices, and arrange secure
review/removal of the host session file **without uploading its bytes**.

## .08 — Reconnect, revocation, duplicate readers
The cloud runtime calls `connect()` plus `is_user_authorized()`,
never interactive `start()`. It now repeats authorization on a transport
reconnect before matching `get_me()`; revoked/expired authorization
fails closed. The existing bounded reconnect sequence retries transport
errors, not identity mismatches, and the lock prevents two readers on
a *single shared volume*. Provider infrastructure must also enforce one
replica globally; a file lock cannot protect two hosts using independent
filesystems. Manual owner phone-off/sleep, VM restart, crash recovery and
revocation require genuine operator acceptance.

This feature is limited to **all NEW incoming cloud messages** available
while the client is connected, in-memory deterministic non-AI counters,
and no historical broad backfill. Telegram Secret Chats are not readable
by this cloud session. No claim is made that the listener can recover
missed incoming messages after downtime.

## .09 — Privacy-safe processing latency, not sniper certification
The existing live handler now measures a bounded rolling in-memory
monotonic processing duration around recognized **new and edit**
handlers. Every 100 accepted event handlers (up to 256 most recent)
it may print only local p50/p95/p99 process durations and sample size;
no Telegram texts, addresses, sender/chat IDs, message timestamps,
user identity or provider payloads are retained. Bad or reversed
monotonic samples are rejected. Neither offline tests nor local
handler percentiles are a genuine Telegram network receipt, source
publish time, first on-chain discovery, RPC response, real quote, fill,
or certified 0.6-second launch-to-trade result.

To measure genuine on-chain discovery later, separate timestamped
PUBLIC-chain event subscription and independent chain/RPC/DEX availability
receipts are necessary. Handle clock provenance, sample counts, dropped
events, reconnect time, provider failures and actual fee/slippage models
in existing SHARK/Shadow paper research, *without joining private
Telegram data to an AI model*. Telegram source timestamps alone do not
establish event prediction performance.

## .10 — Acceptance/independent release and iPhone controls
`cloud_commissioning.py` + `cloud_commission_evidence.json` define
immutable code-only status. The external host, iPhone, rights,
session, message, reconnect and timing checks are explicitly UNVERIFIED,
with deployment/listening/model/trade/sign/spend permissions FALSE.
Changing a JSON field to VERIFIED or enabling a named environment flag
does NOT approve production. The pre-existing independent
`personal_release_gate.py --mode release` remains exit code 1.
The new `cloud_commissioning.py --mode release` must also exit 1.

The following **external acceptance** must be independently demonstrated
and redacted before a later release decision:
1. Owner explicitly accepts the exact dedicated host, budget and provider;
   verify SSH identity, encrypted durable disk and isolation from PupsonStuff
2. Only the owner's SSH session performs Telethon enrollment; verify
   connected account ID privately, successful logout from setup process
3. Prove a fresh owner-permitted incoming event and a negative excluded
   chat case without placing message contents or addresses in CI artifacts
4. Confirm one reader, physical iPhone readback, VM reboot/restart,
   network outage/reconnect, Telegram device authorization revocation,
   no inadvertent unattended account reauthentication or double session
5. Record authentic platform CPU/network/storage and public chain/RPC
   timing. Report p50/p95/p99, sample size and missed/unknown coverage
6. Complete Telegram data-use and third-party source rights review
7. Obtain independent production release decision; backups, off-host
   encrypted storage and second-host restoration each need explicit scope
   and consent. Never use default GitHub archives for Telegram sessions
8. Keep purse, wallet, live trading, source-to-AI integration, paid plans
   and autonomous action **disabled** unless separately and lawfully approved

## Source-level commands (run only on reviewed source; no account access)

```sh
python3 -m compileall -q scripts/shark-telegram
python3 -m unittest discover -s scripts/shark-telegram -p 'test_*.py' -v
python3 scripts/shark-telegram/cloud_commissioning.py --mode source
python3 scripts/shark-telegram/personal_release_gate.py --mode ci
# These deliberately return 1, NOT authorized:
python3 scripts/shark-telegram/cloud_commissioning.py --mode release
python3 scripts/shark-telegram/personal_release_gate.py --mode release
```

## Status ledger
| Component | Repository state | Independent runtime status |
| --- | --- | --- |
| .06 Read-only host inventory | Current Railway project/services inspected | **No dedicated host certified** |
| .07 SSH setup and lock | Committed + hermetic tests | **Not enrolled / not authenticated** |
| .08 Revocation-safe reconnect | Committed + hermetic tests | **Not exercised against Telegram** |
| .09 Local metrics | Committed + synthetic tests | **No live samples or 600ms proof** |
| .10 Acceptance contracts | Committed, CI at exact PR head needed | **Production held** |
| @R2dice2bot owner one-shot | Preserved in earlier source | **No new bot consumer** |
| SHARK/Shadow/Money | Existing canonical public source | **No Telegram input, money, signing or orders** |

**Next gated milestone** is actual host/operator approval and offline exact-head
CI reconciliation, then separate private real device commissioning. A source
PR merge by itself cannot certify a 24/7 listener.
