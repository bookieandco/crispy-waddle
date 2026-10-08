# GOOGLE-HOMEBASE-LIVE.1 — post-merge, no-new-server commissioning preflight

**Date:** 2026-10-07
**Parent:** PR #1139 merged as `390f062c649918f7f1eee02b1416ce39659d3d91`.
**Source:** `infrastructure/homebase/google-drive/commissioning_preflight.py`.

## Current proven state

1. The owner ran a 64-byte **synthetic DVC** Colab-to-personal-My-Drive round trip, and reported `mounted_personal_drive_remote_roundtrip_verified=true`, with SHA-256 `dc1c480a367687cfec18cfb6f7380598f4574fac976a84c2c88d203afbd6a814`. The connected Google Drive connector independently saw the 64-byte uploaded object; the pull/checksum was owner-supplied notebook output.
2. PR #1139's **57/57 dedicated tests** and five required GitHub workflows passed on head `fa0bab05c576b238afceed1ee264907bb8ca8106` and it merged into `main`. These were source checks, not private database restores.
3. The iPhone is **operator only**; the Drive account is personal My Drive, not a Workspace shared drive. An interactive Colab mount does not grant GitHub Actions machine OAuth or continuous availability.
4. No server was purchased, no production authority moved, and Supabase/RunPod remain unchanged.

## Optional preflight without a machine

From any Python 3 environment containing this repository checkout:

```sh
python3 infrastructure/homebase/google-drive/commissioning_preflight.py
```

Expected: `profile=IPHONE_OPERATOR`, `mode=CONTROL_ONLY`, `overall_live_ready=false`. This reports architecture facts only. **Do not run the command or Docker on the iPhone**; viewing the output/report in GitHub is enough for a phone-only operator.

## Only on an existing owner-controlled Linux runtime

The next stage is to identify an **existing**, approved, secret-capable Linux runtime (not a paid replacement GPU). Do **not** create a new server simply to run the preflight. If one is accessible under the owner's control, install the relevant tools using its normal provisioning process and run:

```sh
JHADINA_HOMEBASE_TRUST_DOMAIN=OWNER_CONTROLLED \
JHADINA_HOMEBASE_PREFLIGHT_APPROVED=YES \
python3 infrastructure/homebase/google-drive/commissioning_preflight.py --profile trusted-worker
```

The worker's local, private environment may also contain:
- `GOOGLE_HOMEBASE_RCLONE_REMOTE`: approved dedicated rclone remote name
- `GOOGLE_HOMEBASE_BACKUP_FOLDER_ID`: exact private backup folder locator
- `RESTIC_PASSWORD_FILE`: **owner-only 0600**, regular, non-symlink secret file path
- `JHADINA_BACKUP_ROOT`: absolute private snapshot root

**Never post these environment values, OAuth tokens, Restic passphrases, MinIO aliases or NATS credentials in GitHub issues, chat or CI logs.** The preflight returns only Boolean availability checks. It never executes provider commands, reads a password, dumps a database, runs a job, uploads data, or provisions compute.

When every prerequisite reports true, `next_action=RUN_SEPARATELY_APPROVED_REAL_OAUTH_AND_RESTORE_DRILLS` is **only a next step**—not a ready/approved machine or a verified backup. A service can fail even when its binaries exist. `live_gates` and `overall_live_ready` remain false. Actual subsequent proofs must come from separate owner-controlled real operations:
1. Google rclone exact remote scope + machine OAuth verification, and independent Restic passphrase recovery.
2. One encrypted PostgreSQL snapshot with exact Restic download verification and isolated database `pg_restore` with integrity checks.
3. MinIO object archive plus isolated **API-level** object/metadata restore, without compromising production.
4. NATS stream archive and isolated API recovery including **consumer ack positions**, not just message count.
5. Active scheduled backups, delivered alerts, retention rehearsal, rollback and all-domain end-to-end canaries.

The preflight refuses treating hosted GitHub Actions as a trusted machine. GitHub CI can run the *hermetic unit tests* without credentials; never grant confidential backup secrets to a public hosted runner.

## Operational cutover invariant

Even after tests pass, this preflight provides **no deployment permission**. It cannot authorize new spend, trigger RunPod, alter Supabase, move Jhadina's live database, retire providers, or certify `HOMEBASE.FINAL`. These require separate trusted receipts and owner/governance approval. Until then: **SOURCE MERGED / SYNTHETIC STORAGE VERIFIED / LIVE RECOVERY BLOCKED**.
