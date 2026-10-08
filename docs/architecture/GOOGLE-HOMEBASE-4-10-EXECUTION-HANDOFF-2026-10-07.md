# GOOGLE-HOMEBASE.4-.10 — phone-first commissioning handoff (2026-10-07)

**Canonical repo:** bookieandco/crispy-waddle; draft PR #1139. **Present device:** iPhone-only Homebase operator. **Connected Google account:** ChatGPT Google Drive connector, not a Google API credential on a Linux worker. **Cloud spend:** No new paid resources or machines authorized/provisioned by these changes.

## Architecture boundary

This work does NOT replace or duplicate the pre-existing Homebase/Postgres/MinIO/NATS, Direct/Watch/Shadow One-Shot, RunPod runtime, Supabase Auth/RLS/Realtime, Action Core, or domain-specific state machines. The iPhone is operator UI; cloud compute and a durable 24x7 data authority remain external and must be independently verified. Google Drive is archive/backup, not transactional database or GPU.

## Per-stage status and immutable proof requirements

| Stage | Source implementation | Real commissioned proof |
| --- | --- | --- |
| .4 Exact-head CI and folder restriction | Python unit CI; backup.py validates rclone provider=drive and exact approved root_folder_id, never prints token | CI exact PR SHA all required checks green, separate review complete |
| .5 Separate Google OAuth on trusted worker | Fail-closed worker scope, private Restic key/remote contract | Trusted machine identified, OAuth completed there, local secret store verified |
| .6 DVC Google Drive remote canary | dvc_canary.py creates synthetic non-sensitive payload, pushes, destroys ONLY scratch cache, pulls, SHA256 checks | Run on trusted existing worker with --live; unique immutable receipt |
| .7 PostgreSQL + object restore | backup.py and restore_drill.py verify Restic bytes and import to disposable network-isolated PostgreSQL | Actual PG import+readback; MinIO objects+metadata restore; NATS recovery; owner can recover Restic password |
| .8 Monitoring, retention, alerts | monitor.py checks timestamped verified receipt; disabled systemd timer examples | Timers observed active on owner-controlled host; test stale backup alerts delivered; retention reviewed in dry-run; NO auto pruning |
| .9 Supabase/RunPod dependency and cost audit | evidence-only .9 gate in google-homebase-progress.ts | Demonstrated Auth/RLS/Realtime replacement or retention, all dependent apps audited, RunPod spend and compute capacity checked; rollback ready |
| .10 Jhadina domain canaries | evidence-only .10 gate + tests covers Director, OverageOS, Shark, Music, Social and Business Factory | Genuine end-to-end canary for every listed domain, owner final review |

**Do not write “complete” just because source code and mocked tests pass.** The matrix is advisory; a caller must source independently verified receipts from trusted providers and cannot authorize any external action. Provider cutover/deletion/spend must pass the existing domain and Action Core approval flows.

## Commands when an authorized owner-controlled worker exists

Do NOT attempt Python/Docker CLI on iPhone. Do NOT run the private database restore on GitHub-hosted Actions runners. Do not create a new paid GPU.

1. Install on the trusted existing host (not in this chat): Python, Docker with a pre-pulled postgres:17-alpine image, Restic, rclone, DVC and dvc-gdrive. Have a verified current Git checkout of PR #1139/main after merge.
2. Grant scoped Google Drive OAuth on that host (independent of ChatGPT login). Configure rclone remote name, exact private backup folder root_folder_id and a private password file. In the host-only environment set:
   - GOOGLE_HOMEBASE_RCLONE_REMOTE=jhadina-drive
   - GOOGLE_HOMEBASE_BACKUP_FOLDER_ID=<exact private 01-BACKUPS folder ID>
   - RESTIC_PASSWORD_FILE=<absolute owner-only 0600 secret path>
   - GOOGLE_HOMEBASE_DVC_FOLDER_ID=<exact 07-DVC-VERSIONED-ASSETS folder ID>
3. Run `python3 infrastructure/homebase/google-drive/backup.py doctor`. Initialize Restic only for a new empty repository using `init`, then `backup-db` only when a real already-running local PostgreSQL service exists. Retain the emitted snapshot ID, SHA256 and private receipt.
4. For a disposable *database* rehydrate, set local-only JHADINA_RESTORE_TRUST_DOMAIN=OWNER_CONTROLLED and JHADINA_RESTORE_APPROVED=YES, then run `python3 infrastructure/homebase/google-drive/restore_drill.py --receipt <private-receipt-file>`. The drill starts a network-isolated postgres container, imports to a disposable database, asserts application tables exist, and removes the container. This alone does not prove every subsystem's semantic integrity.
5. For synthetic DVC cloud proof, set local GOOGLE_HOMEBASE_DVC_CANARY_APPROVED=YES and run `python3 infrastructure/homebase/google-drive/dvc_canary.py --live`. Never substitute private files.
6. After real backup receipts exist, run `python3 infrastructure/homebase/google-drive/monitor.py`. The systemd units are examples only, not installed, activated, or configured to send iPhone notifications.

## Supabase and RunPod audit observations

The current source still imports Supabase Auth in `apps/jhadina-web/src/app/login/actions.ts`, `apps/jhadina-web/src/lib/supabase/server.ts`, `apps/jhadina-web/src/lib/supabase/middleware.ts`, `apps/jhadina-web/src/lib/auth/current-user.ts`, and protected workstation API routes. PupsonStuff commerce/server code also uses Supabase service-role persistence. A Google Drive archive cannot replace these login, row security, transaction and realtime contracts. Avoid untested zero-downtime claims.

The repo still uses RUNPOD_API_KEY in `scripts/director-runpod-live-commission.py`, RunPod agent setup/Director workflows, and the Homebase execution adapter. DVC/Drive do not supply worker compute, and Colab quotas do not guarantee unattended production GPU availability. Do not switch or decommission RunPod until equal workload output and economic receipts exist. Do not require a new GPU to test synthetic storage.

## What is actually verified in this conversation

- Connected interactive Google Drive can browse the private JHADINA-HOMEBASE folders; dedicated backup and DVC storage folders exist.
- No separate machine Google OAuth, live Restic backup, database rehydrate, MinIO/NATS restore, DVC push/pull, scheduled timer, financial migration or cross-subsystem E2E canary was observed.
- No owner-controlled worker is exposed to the connected tools in this thread. GitHub Actions can test code but is deliberately denied the private restore drill.
- The accepted topology is an iPhone for owner control and existing authorized providers for work; source code is staged in PR #1139, with no production cutover.

## Operator blocker and handoff

First resolve exact-head CI on PR #1139. Then identify a trusted existing worker that can hold narrowly scoped OAuth and Restic recovery credentials, prove storage canaries without adding a billable GPU, and only afterward run backup, MinIO/NATS recoveries and business E2E. If no such host is available, remain **GOOGLE-HOMEBASE SOURCE COMPLETE / LIVE BLOCKED** rather than pretending the iPhone is a PostgreSQL server.

## GOOGLE-HOMEBASE.7 continuation — bounded MinIO archive (2026-10-07)

New module: `infrastructure/homebase/google-drive/minio_backup.py` plus `test_minio_backup.py` and `MINIO-RECOVERY.md`. It enforces the existing private Google Drive Restic remote and an explicit owner-controlled worker; accepts only a loopback MinIO client alias; inventories one bucket with hard ceilings (1,000 objects / 128 MiB); exports CURRENT object bytes to a disposable scratch folder; hashes them; writes an encrypted Restic snapshot; restores it to another disposable scratch directory; checks the full SHA-256 manifest; and issues a private local receipt only after remote byte restoration succeeds. It never edits live MinIO objects.

The module is intentionally bounded: it is **not** atomic across files, does **not** retain version history or all bucket policies/metadata, does **not** prove MinIO API rehydration, and does **not** independently establish that a trustworthy worker can run. It cannot fulfill the .7 full-object recovery gate alone.

Also fixed the PostgreSQL Restic dump file path to `/jhadina-postgres.dump` to match the existing isolated restore drill. Exact-head CI and any live proof must still be checked before marking status green.

NATS JetStream still requires an isolated stream snapshot + consumer-state restore drill. The official CLI distinction matters: configuration-only `nats backup` is not the same as a data-bearing `nats stream backup` / `nats account backup`. No stream data restore is claimed here.

No new server or paid GPU was provisioned; the connected Drive connector is independent of machine OAuth; the iPhone remains the operator. Do not merge or decommission providers solely from source tests.
