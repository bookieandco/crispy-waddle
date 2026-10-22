# TELEGRAM-CLOUD.RAILWAY.STAGE.16–.19 — 2026-10-22

**State: code-only / Railway STAGED, never deployed or authenticated.**
This is a *dependent* source PR on top of cloud PR #1491, not a
replacement for PRs #1464, #1490 and #1491. All must be reviewed in order.

## Railway account evidence (read from connected Railway account)
- Dedicated PRIVATE project: **Jhadina Telegram Cloud**
  `35f38a85-097c-4e77-ad17-1b84554f8d44`
- Environment: `staging`, `83b41578-7cc6-46e5-9198-6293c6cfd868`
- Worker **staged-create**: `jhadina-telegram-owner-listener`,
  `3315c6a7-755b-422c-a317-4d8b601645f2`
- Persistent 512 MB volume **staged-create**:
  `b11bbd8b-0f53-46af-921c-bcec12866778`
- Proposed mount: `/var/lib/jhadina-telegram`, one service replica.
- No deployment instance, no provisioned volume, no domain, no Telegram
  API secrets, no Telegram user session, no bot consumer, no billable
  worker activity evidenced. The source will be pinned to a reviewed
  commit before any approved deployment.
- OverageOS and PupsonStuff Media Services are DIFFERENT projects and
  must not be edited or have their workers repurposed.

## Bundle contents
- `ops/telegram-cloud/Dockerfile` uses existing pinned Telethon
  `scripts/shark-telegram/requirements.txt` (`telethon==1.45.0`).
  Build context is the REPOSITORY ROOT, Dockerfile path
  `ops/telegram-cloud/Dockerfile` (not a subdirectory build context).
- `entrypoint.sh`: only `TELEGRAM_CLOUD_PROCESS_MODE=hold` permitted.
  Requires `RAILWAY_VOLUME_MOUNT_PATH` and declared persistent mount
  to match. Not a production listener entrypoint.
- `host.py` prepares a dedicated 0700 private dir on a real mounted
  volume, checks symlink/ownership and any preexisting 0600 session/lock,
  then runs a nonroot *sleep-only* process. No sockets or Telegram imports
  in the held process. It will not silently overwrite a session.
- New hermetic offline tests cover fake mounted volumes, escape/symlink
  boundaries, permission failures and no activation path. They cannot
  certify Railway build, owner iPhone connection or real reception.

## Stage-only configuration, NOT authority to deploy
For staged source, use connected repo `bookieandco/crispy-waddle`
and this exact reviewed PR commit, not `main` and not a moving branch.
Do not connect a live auto-deploying branch. The intended configuration:
```
RAILWAY_DOCKERFILE_PATH=ops/telegram-cloud/Dockerfile
TELEGRAM_CLOUD_PROCESS_MODE=hold
TELEGRAM_CLOUD_MOUNT=/var/lib/jhadina-telegram
TELEGRAM_PRIVATE_DIR=/var/lib/jhadina-telegram/private
```
Railway's own `RAILWAY_VOLUME_MOUNT_PATH` must come from the actual volume.
Never spoof it merely to satisfy the startup check.

**Do not set** `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`,
`TELEGRAM_ALLOWED_USER_ID`, OTP, Telegram 2FA, session bytes,
`TELEGRAM_BOT_TOKEN`, bot owner HMAC, wallet keys, exchange credentials,
or source-chat identifiers in PR files, CI, or ordinary logs.
If eventual authorized owner enrollment happens, use Railway's private
SSH access with a verified host key and owner-registered credentials, not
a public web sign-in URL or ChatGPT messages. No one should ask the
owner to paste any one-time codes into a chat.

## Cost and service activation gates
- Hobby is a $5/month subscription with $5 resource usage included,
  **shared across all services** in the billing workspace. Extra usage is
  chargeable; the prior subscription is not permission for overages.
- Railway cost-control docs currently say Compute Usage hard limits have
  a **$10 minimum**, cannot guarantee a $5 monthly maximum and may stop
  OTHER services in the same workspace. Verify actual alert/hard-limit
  settings in the owner dashboard before live deployment.
- A 512 MB volume is **only staged**, not billed/provisioned here.
- One proposed service is not a running, continuously available listener.
  The held process, if eventually deployed, would incur usage without
  collecting useful events. Do not accept/apply the staged changes until
  the operator confirms exact service, measured cost and purpose.
- Railway's staging patch can be applied only by a separately authorized
  `accept-deploy` action or explicit dashboard apply, which is
  **NOT part of this sequence**.
- No SHARK AI ingest, paid plan upgrade, trading, signatures, or
  Jhadina Purse spending.

## Next responsible execution
1. Verify the exact-head offline GitHub Actions and existing PR dependency
   chain; do not infer passing tests from older heads.
2. Verify Railway staging-only worker source, same pinned SHA, matching
   Dockerfile path, variables *names/values not secrets*, attached volume,
   single replica, no domain and no changes outside this project.
3. Owner checks workspace cost alert/limit without interrupting other
   production deployments; document chosen budget and regional costs.
4. Explicitly approve a DISABLED build/deployment, measure real build
   and memory/CPU/volume start only, confirm nonroot hold and no network
   activity. This is a **separate** authorization from staging.
5. Once the private host is trusted and terms/rights reviewed, separately
   approve owner iPhone SSH Telethon enrollment and test revoked sessions
   without uploading codes or session files; still no production listener.
6. Release gate and runtime source require a separate reviewed PR after
   genuine authentication/latency evidence and independent owner approval.
   Keep Telegram content out of unauthorized AI/ML, public SHARK canary
   and wallets.

References:
- `docs/architecture/TELEGRAM-CLOUD-COMMISSION-06-10-2026-10-22.md`
- `docs/architecture/TELEGRAM-CLOUD-INDEPENDENCE-01-05-2026-10-22.md`
- `scripts/shark-telegram/personal_release_evidence.json`
- Railway docs: https://docs.railway.com/pricing/cost-control
- Railway docs: https://docs.railway.com/cli/ssh
