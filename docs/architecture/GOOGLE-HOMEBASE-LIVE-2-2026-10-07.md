# GOOGLE-HOMEBASE-LIVE.2 — synthetic Restic encryption + strict source boundaries

**2026-10-07 local evening.** Status: source staged for review; confidential production backup and recovery **NOT commissioned**.

## Verified foundations

- PR #1139 merged to main as `390f062c649918f7f1eee02b1416ce39659d3d91` with encrypted backup, scoped Drive OAuth contracts, isolated database and queue drills.
- PR #1143 merged to main as `ae3978f6fd92b9abfbbde96545e2173959a3bb0f` with read-only iPhone/worker preflight; all four exact-head CI checks passed.
- Owner completed Colab-mounted personal My Drive DVC remote-only roundtrip for 64 random bytes; notebook printed `mounted_personal_drive_remote_roundtrip_verified=true`. SHA-256 `dc1c480a367687cfec18cfb6f7380598f4574fac976a84c2c88d203afbd6a814`; separate Google Drive metadata showed the corresponding 64-byte stored object. The hash check is owner-reported output.
- Supabase plugin read-only inventory earlier in this build reported Swlc and Pupsonstuff `ACTIVE_HEALTHY` on an organization Free plan. This does not establish that an offline, independently recoverable copy of either production database exists.

## Added in LIVE.2

1. `infrastructure/homebase/google-drive/COLAB-ENCRYPTED-RESTIC-SYNTHETIC.ipynb`: owner-driven test from existing Colab environment, mounts the existing **personal My Drive** `01-BACKUPS` folder; creates a fresh random Restic repository with a session-only random key; encrypts **64 synthetic bytes** to that mounted folder; dumps immutable snapshot and verifies SHA-256; prints a strictly scoped result. No new paid server, real database, production data, permanent secret, RunPod job, or remote deletion.
2. `test_colab_restic_contract.py`: verifies notebook syntax, exact dedicated destination, generated synthetic payload, encrypted Restic upload/dump and failure-limited evidence fields.
3. `backup.py` now requires `JHADINA_POSTGRES_BACKUP_SOURCE=LOCAL_HOMEBASE_COMPOSE` before issuing any Docker Compose PG snapshot and stamps the receipt `source_kind=LOCAL_HOMEBASE_COMPOSE`, `hosted_supabase_data_covered=false`. It refuses to represent a **local** logical dump as a Swlc/Pupsonstuff **hosted Supabase** recovery.
4. The command now preserves symlink checks on backup-root paths instead of calling `.resolve()` before inspection. Tests verify no-provider-action fail closed when the source is absent or mislabeled.

## Exactly what can be done now (owner phone / Google Colab)

After the source PR is reviewed, follow the notebook:

`https://colab.research.google.com/github/bookieandco/crispy-waddle/blob/feat/google-homebase-live-2-restic-synthetic-20261007/infrastructure/homebase/google-drive/COLAB-ENCRYPTED-RESTIC-SYNTHETIC.ipynb`

It must print `encrypted_mounted_drive_roundtrip_verified=true` and a `sha256` for its **new** generated 64 bytes. The result must also report `machine_rclone_oauth_verified=false`, `server_unattended_backup_verified=false`, `postgres_database_restore_verified=false`, `minio_nats_recovery_verified=false`, `encryption_password_recovery_after_session_verified=false` and `production_backup_restored=false`.

This is one-time disposable encryption **transport** proof only. The temporary passphrase is not escrowed; do not call this a durable recoverable backup after Colab terminates. Do not store or upload personal/secret data into this demo repository. Folder remnants are harmless encrypted synthetic objects; do not delete remote data automatically.

## What is blocked

A trusted owner-controlled, durable, already-existing runtime with approved secret storage is still needed for production PostgreSQL/MinIO/NATS backup and isolated restore. The source Homebase Compose database is not shown to be the source of truth for the active hosted Supabase projects. Do NOT run the local `backup-db` command against Swlc/Pupsonstuff or grant live Supabase credentials to public GitHub Actions. The Supabase connector does not substitute for a database backup export tool.

The chain in [issue #1144](https://github.com/bookieandco/crispy-waddle/issues/1144) remains:
`trusted existing runtime → scoped machine OAuth + key recovery → real encrypted database snapshot → isolated PG data/schema restore → MinIO API object/metadata recovery → NATS durable consumer ack state/replay → delivered alert/schedule → owner-approved end-to-end acceptance`.

Until live receipts exist: **SOURCE IMPLEMENTED / ENCRYPTED SYNTHETIC DEMO OWNER ACTION PENDING / PRIVATE PRODUCTION BACKUP BLOCKED**. No provider cutover, paid instance, or new server is created by this PR.


## Receipt compatibility and safety migration

`restore_drill.validate_receipt` and `monitor.check_backups` now require the explicit `source_kind=LOCAL_HOMEBASE_COMPOSE`, `hosted_supabase_data_covered=false` fields from the backed-up source. Receipts predating this source provenance gate are **unverified/legacy** for the purposes of automated restore acceptance and freshness monitoring; do not silently upgrade them to certified local-backup receipts. If a legacy local backup must be recovered, prove its actual source independently under owner-controlled review and generate new versioned evidence. Never relabel it as Swlc/Pupsonstuff hosted Supabase coverage. Unit tests cover wrong/missing source kinds.
