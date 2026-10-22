# TELEGRAM-CLOUD.INDEPENDENCE.01–.05 — Mac-free implementation and handoff
Date: 2026-10-22. Base: draft recovery PR #1464 @ 529d810. Changes are a
**dependent draft**: source preparation only, not a deployed service.

## .01 — Keep ONE canonical listener
- Reuse `scripts/shark-telegram/telegram_intake.py` personal-account Telethon
  event handlers. No fork of SHARK/Shadow/Money/Purse and no competing
  @R2dice2bot getUpdates consumer.
- `cloud_personal_listener.py` provides cloud *preflight*, interactive
  *enroll*, and a production-gated *run* command. This is a persistent
  MTProto account-session design, not a Cloudflare Worker/HTTP webhook.
- The existing owner bot one-shot private public-mint research remains unchanged.

## .02 — iPhone only, via authenticated private SSH
Use an **owner-controlled iPhone SSH client with SSH key authentication**
to reach a separately approved, isolated Linux VM. This is NOT iSH
running in the phone background. Do not create an unauthenticated
browser login page, paste credentials into GitHub Actions, or export a
StringSession/SQLite session to an external onboarding service.

Operator-only preparatory steps **after owner approval of the host/cost**:
1. Verify dedicated non-shared VM ownership, plan and expenses. Configure
   SSH-key-only access with host-key verification, firewall and OS updates.
   No public Telegram web endpoint is required.
2. Install only the reviewed source and pinned Python dependency in
   `/opt/jhadina/.venv` (Python 3.12, `telethon==1.45.0`).
   Never auto-run the listener via checkout, CI, cron or SSH login.
3. Attach an encrypted **persistently mounted** dedicated data volume.
   Example `TELEGRAM_CLOUD_MOUNT=/var/lib/jhadina-telegram` and
   `TELEGRAM_PRIVATE_DIR=/var/lib/jhadina-telegram/private`.
   Verify the mount with `findmnt` and operator inventory; don't just
   create a folder on an ephemeral container filesystem.
4. Provision service identity `jhadina` without root privileges;
   create private directory owned by that account with mode 0700.
   Ensure Telegram session and lock are regular 0600 files, with no
   symlinks. One replica only; do not mount the same session concurrently
   in a Mac/iPhone reader and remote cloud service.
5. Store `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` and
   independently verified `TELEGRAM_ALLOWED_USER_ID` in an operator-
   managed root-only protected service environment file. Keep any Telegram
   Bot token/HMAC key OUT of this personal service. Do not publish IDs or
   tokens in this repo, logs, ChatGPT, Drive or screenshots.
6. Over the private SSH TTY, **after explicit owner enrollment approval**,
   set `TELEGRAM_CLOUD_ENROLL_APPROVED=YES` *in the authenticated
   shell*, load protected app configuration and run:

   `python scripts/shark-telegram/cloud_personal_listener.py enroll`

   Enter Telegram verification code and optional 2FA **only in the SSH
   terminal**. `enroll` checks `get_me()` against the independently
   confirmed numeric ID, then disconnects WITHOUT observing messages.
   A wrong-ID login is a hard stop; revoke it in Telegram > Settings >
   Devices, and remove the local session using owner-controlled procedures.
   SSH/network and host compromise remain genuine security risks; this is
   not a zero-trust authenticated web login.
7. `python scripts/shark-telegram/cloud_personal_listener.py preflight`
   checks local storage/session *presence only*, NOT authorization,
   connectivity or that a real message was received.

## .03 — Restart/revocation/observability
- On a reviewed private VM, a separate opt-in installation may use
  `telegram-cloud.service.example` as a **template**, not an enabled unit.
  It needs `/opt/jhadina`, `/etc/jhadina/telegram-cloud.env` (root-only),
  `/var/lib/jhadina-telegram` private mounted storage, one worker and
  external host monitoring. Recheck the unit after adapting paths.
- The existing handler now uses `connect()` +
  `is_user_authorized()` in cloud-noninteractive mode, NEVER `start()`
  with interactive code/phone prompts on a daemon restart. A revoked
  session fails shut; operator re-enrollment is mandatory.
- Existing bounded transport reconnect checks owner identity after connect.
  Service start limits prevent endless rapid restarts; do not infer 24/7
  continuity, Telegram SLA, no missed messages or subsecond latency.
- Owner-side lifecycle: Telegram Settings > Devices > terminate cloud
  authorization, then shut down VM service and securely dispose of
  session/disk. Revocation must be independently tested.

## .04 — SHARK handoff with lawful data boundary
There is deliberately **no automatic Telegram -> SHARK -> JLLM flow**.
The live all-chat reader exposes only transient, non-AI format/count labels
with no mint address, private source, chat ID, message text, sender or
timestamp persistence. A migration/rug tag is a text claim, not verified
chain evidence. This means the desired autonomous Telegram-channel alpha
and sniper integration are **NOT activated** by cloud portability.

Independent **owner-selected PUBLIC Solana mint** observations must use
the existing `ops/meme/public_alpha_canary_once.py` (same manual
GitHub Actions public-mint canary; no source data passed from Telegram).
It reuses SHARK's public DEX/RPC readers and quarantines gaps. It does
not generate executable quotes, safe sellability, ML learning, paper fills,
transactions or wallet signing. Existing typed Telegram evidence bridge
remains evidence-only and is not connected to the cloud listener.
Prioritize a separately sourced on-chain event stream for future
low-latency discovery; Telegram message timing is not launch-time proof.

## .05 — Evidence gates and remaining real-world checks
New offline tests reject ephemeral/unmounted storage, insecure ownership
and session permissions, symlinks, CI/build execution, credential leakage,
double Bot API ownership, revoked-session headless sign-in, missing
approval and false release promotion. Existing release manifest and
`personal_release_gate.py --mode release` **must continue exiting 1**.
Neither a GitHub Actions pass nor manually setting `TELEGRAM_CLOUD_OWNER_APPROVED`
or `TELEGRAM_CLOUD_RIGHTS_REVIEWED` is production permission. Future
independent release review must update the canonical release policy after
real-world evidence, never silently bypass it.

Acceptance needed before deploying/enabling: separate host/budget approval,
SSH owner enrollment, real account ID and fresh incoming-event evidence,
Telegram terms/rights review, excluded-chat privacy, disconnect/reconnect,
revocation, volume durability, actual p50/p95/p99 timing, missed-message
reporting, single-instance recovery, iPhone readback and off-host encrypted
backup/restore (if backups are separately authorized).

## Verified vs blocked
- **Code changes:** this PR (reviewed only after CI at exact head).
- **Previous recovery tests:** passing on #1464 head 529d810; not
  proof of new tests, live session or cloud production.
- **External state:** no VM provisioned, no secrets transferred, no owner
  Telethon session enrolled, no DNS/port opened, no paid service, no
  deployment, no Telegram polling or data transfer, no wallet/trades.
- **Still blocked:** #1238 trusted personal login and real event receipt,
  production release evidence, operator deployment consent and runtime
  certification. Keep #1464 draft until source reconciliation is reviewed.
