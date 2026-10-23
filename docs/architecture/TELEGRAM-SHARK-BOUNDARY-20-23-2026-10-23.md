# TELEGRAM-SHARK.BOUNDARY.20–.23 — 2026-10-23

**Status: live Railway hosting verified for an inert worker; this PR is SOURCE-ONLY, not deployed.**
**No Telegram owner enrollment, no Telegram-to-SHARK signal transport, no sniper
automation, no Phantom wallet signing, no trades, no provider payments.**

## .20 — Actual Railway status, not source claims

Verified via connected Railway resource reads (October 23, 2026):
- PRIVATE project `35f38a85-097c-4e77-ad17-1b84554f8d44`
  (Jhadina Telegram Cloud), `staging`
  `83b41578-7cc6-46e5-9198-6293c6cfd868`.
- Dedicated worker `3315c6a7-755b-422c-a317-4d8b601645f2`
  has **SUCCESS** deployment `34301f8d-b2cb-4de0-aa26-af336c048aaa`
  on pinned **commit `3eb33ce62e1f347fcc402ead62d3b2a5ebf118b3`**.
- One online replica, no active staged changes, no public URL or domain.
- Persistent volume `b11bbd8b-0f53-46af-921c-bcec12866778`
  is 512 MB, live and attached at `/var/lib/jhadina-telegram`.
- Startup log: `TELEGRAM_CLOUD_VOLUME_PREPARED_NO_ACCOUNT_LOGIN` then
  `TELEGRAM_CLOUD_HELD_NO_TELEGRAM_CONNECTION_NO_TRADES`.
- 24-hour reported average memory about 0.0071 GB, latest about 0.0113 GB;
  observed network TX/RX sample summaries zero. These are Railway-metric
  samples, NOT a billing invoice or proof of every network action.
- **No restart/redeploy**, because this service has a mounted volume and
  the user separately approved only the inert staging activation. No
  session contents, off-host backup/restore or restart-persistence test
  can be assumed from a successful initial mount.
- Actual Railway hard billing limit/usage not exposed to connected OAuth
  tools; do not claim a $5 cap. Workspace minimum configured hard limit
  permitted by Railway docs: $10, affecting all workspace services.

New `ops/telegram-cloud/owner_storage_readiness.py` is *review-only* and
does not change the live pinned container. When later deployed under
separate approval, an operator can run it within owner-authenticated
Railway SSH. It inspects only mount metadata, 0700 directory, 0600
session/lock mode, symlink and service UID. It never opens session bytes,
never calls Telegram, and never asserts SSH identity or Telegram account
match. Returns fixed boolean fields, not paths or account identifiers.

## .21 — Owner iPhone SSH pre-enrollment, HELD

Railway supports private `railway ssh` and SSH keys registered with the
account. A service without a public domain can use **service instance ID**
with `ssh <service-instance-id>@ssh.railway.com`. The instance ID is NOT the
service ID in the project metadata; the operator must copy it explicitly
from the Railway service dashboard's command palette. Verify SSH host key
and signed-in Railway account before opening a session.

First future approval gate: approve **only a read-only storage diagnostic**,
confirm a nonroot shell, actual mounted volume and no session, then stop.
This version has not been deployed, so do not tell the owner to run its
command on the current pinned image.

Second independent future approval: the owner chooses which Telegram account
and conversations are in scope; reviews Telegram API terms; generates their
own API ID/hash privately at https://my.telegram.org; enters phone/OTP/2FA
only in a verified personal SSH terminal using the reviewed
`cloud_personal_listener.py enroll` action (never in ChatGPT, PRs,
CI output, screenshots or shared Drive). The owner numeric ID must match.
The enrollment code already requires separate `TELEGRAM_CLOUD_ENROLL_APPROVED=YES`.
An interactive enrollment is **not automatically** a production listener.
Do not set broad all-chats collection flags or launch `run` as part of
enrollment. The personal release manifest remains CODE_ONLY with live
evidence UNVERIFIED.

**Security note:** account session is a reusable authentication credential;
a persistent volume is not proof of encryption at rest, backup or isolation
from hosting administrators. Verify those facts separately.

## .22 — Source/rights boundary, enforced

Telegram's actual API terms as of October 23, 2026, section 1.5 state
that Telegram API data cannot be used for training, fine-tuning or the
development, enhancement **or deployment** of AI/ML systems, subject to
the linked Telegram licensing/AI terms. Official:
https://core.telegram.org/api/terms
https://telegram.org/tos/content-licensing

**Do not** feed personal Telegram messages, forwards, Telegram-origin
contract addresses, pseudonymous channel fingerprints or scraped content
to SHARK AI/JLLM, a sniper predictor, Shadow Learn, or a wallet decision.
Merely hashing, removing names or claiming owner-only doesn't grant rights.
The existing experimental `mapDerivedTelegramToShark` adapter is
**not commissioned as a live Telegram-to-AI intake**. All-chat local
ephemeral counters remain legally distinct from automated SHARK learning.
No raw/derived message files are shared, retained as market alpha or
republished. Telegram may provide owner-visible notifications for
independently sourced public-market findings using separately authorized
outbound Bot API delivery; preserve the existing Bot API single-poller
owner and avoid a competing `getUpdates` process.

## .23 — Actually useful safe SHARK separation

The newly added `ops/meme/shark_public_source_gate.py` calls the
ALREADY CANONICAL `ops/meme/public_alpha_canary_once.py`, not a second
token scanner. The gate:
- rejects `TELEGRAM`, `TELEGRAM_FORWARD`, `PRIVATE_CHAT`,
  `TELEGRAM_USER_SESSION`, `BOT_INBOX` and unknown source labels
  before any public-provider read;
- requires exact `OWNER_ENTERED_INDEPENDENT_PUBLIC_MARKET` and existing
  `PUBLIC-MARKET-ONLY` consent, for a user-entered public Solana mint;
- relies on the existing fixed public RPC/DEX canary for format,
  provenance-receipt and partial-public-market evaluation;
- emits only redacted `PAPER_REVIEW_ELIGIBLE` vs
  `QUARANTINED_OR_REFERENCE_ONLY` and no token, private identity,
  training, user-message, signature, wallet or order data;
- never creates a durable SHARK ingress, sniper order or execution permit.
  Code **does not cryptographically prove** an owner-entered mint's
  original discovery source. Operator must truthfully attest provenance.
- is code-only pending PR review; no Railway source or secret changes.

Real automatic SHARK candidate discovery should reuse
`ops/meme/shark_live_intelligence.py` and SHARK's canonical independent
public-chain discovery, not Telegram messages. Follow the existing
SHARK-MONEY research-only envelope -> Money/Purse validation ->
paper/shadow, then separate owner-approved live governed signer gates.
No Telegram data belongs in those inputs.

## Additional acceptance work (separate approvals)
1. Exact-head PR CI and dependent PR sequencing:
   #1464 -> #1490 -> #1491 -> #1495 -> this PR.
2. Private operator SSH/storage check, Railway hard spend alert and backup
   review. A restart test must be scheduled separately to avoid unintended
   downtime or accidental session loss.
3. Owner Telegram data-use/consent review and separately approved
   private owner-session enrollment; revocation and reconnect acceptance
   under the independent release manifest, without production all-chat AI.
4. Public-only automated market feed acceptance with real prospective
   timestamps, synthetic and true prospective paper fill/slippage/fee
   calibration, rug/authority veto, complete error records.
5. Phantom ownership challenge verification on server (current UI stores
   an ownership-verified flag after signMessage without server verifying
   the signature). This is not corrected by this PR.
6. Money/Coffer checks for charter, market route, signer lease, measured
   quote age, P&L and kill-switch; only separately approved canary trade
   after those protections. Wallet observation and signing are distinct.

No cost promise, Telegram source-learning permission, 0.6-second
end-to-end sniper performance, MEV immunity or automatic trading claim.
