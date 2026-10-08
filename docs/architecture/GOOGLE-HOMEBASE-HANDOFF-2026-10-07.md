# GOOGLE-HOMEBASE.2 — Source handoff (2026-10-07)

## Existing authority preserved

See docs/JHADINA_HOMEBASE_1_10.md. Canonical durable authority stays with Homebase PostgreSQL, MinIO and NATS; RunPod remains research/GPU execution only. Google Drive is an encrypted offsite archive and disaster-recovery destination only.

## Observed Google Drive state

Through the interactive Google Drive connector, access was verified to a private JHADINA-HOMEBASE folder and its seven purpose-specific child folders, including 01-BACKUPS. The connected account already contains older personal files and those files were not moved, shared, or deleted. This user-facing connector authorization cannot automatically authorize a separately deployed Homebase/RunPod worker to use Google Drive APIs.

## Implemented

- infrastructure/homebase/google-drive/backup.py: separate rclone Google OAuth remote; scoped path validation; Restic password-file permission checks; explicit doctor/init/backup-db/verify; logical pg_dump -Fc; encrypted Restic backup to a Google Drive remote; exact snapshot ID receipt; Restic byte-restore and SHA-256 comparison; private local receipt; fails closed on bad dumps or corrupt downloads.
- infrastructure/homebase/google-drive/test_backup.py: hermetic safety, failure, recovery-hash and success-receipt tests.
- infrastructure/homebase/google-drive/README.md: commands, source and live proof boundaries.
- .github/workflows/google-homebase-backup.yml: path-scoped hermetic test job.

## Not yet commissioned

1. Homebase host has not separately authorized the private rclone Google Drive remote. Do not treat the ChatGPT connector as worker OAuth.
2. No real RESTIC_PASSWORD_FILE has been provisioned, escrowed and tested on Homebase.
3. No real PostgreSQL-to-Google-Drive snapshot or offsite restored-byte receipt has been observed.
4. No disposable PostgreSQL database has been restored and validated with schema/application checks.
5. MinIO objects and NATS state, recovery of secret stores, offsite receipt archival, retention and watchdog scheduling remain separate tasks.
6. Actual Google AI plan, storage and Colab entitlements must not be inferred from a Drive OAuth connection.
7. This adapter does not replace Supabase Auth, Realtime or active production services.

## Next governed sequence

- GOOGLE-HOMEBASE.3: authorize a private backup-only rclone remote on the existing Homebase/RunPod staging host; no billing changes; test doctor/init and capture a real encrypted PostgreSQL snapshot ID.
- GOOGLE-HOMEBASE.4: byte restore plus import into disposable PostgreSQL; schema/content and application-read receipts. Verify owner can recover Restic credentials.
- GOOGLE-HOMEBASE.5: MinIO/object snapshot and recovery proof; archive manifests and receipts.
- GOOGLE-HOMEBASE.6: schedule backups with health monitoring and bounded retention, run dry-run prune and alarms first.
- GOOGLE-HOMEBASE.7: audit storage and compute prices/limits, then determine which Supabase and RunPod workloads can safely be retired, if any.

A source test is not a production canary. Do not mark Homebase live-ready without live evidence.


## GOOGLE-HOMEBASE.3 — DVC + dvc-gdrive extension (2026-10-07)

User authorized machine-level Google access. This is **authorization to commission**, not evidence that OAuth was completed on the Homebase host. The ChatGPT Drive account can access a newly created dedicated private folder named 07-DVC-VERSIONED-ASSETS under JHADINA-HOMEBASE; its browser link is in the setup chat, and no OAuth tokens were shared.

Reviewed upstream:
- https://github.com/treeverse/dvc : Git-synchronized large-asset metadata, cache, versioned datasets/models, reproducible pipelines
- https://github.com/treeverse/dvc-gdrive : DVC Google Drive plugin, with pydrive2 backend and separate OAuth
- https://dvc.org/doc/user-guide/data-management/remote-storage/google-drive : Google Drive default authorization app may be blocked; custom client or properly granted service account is recommended for automation

New source files:
- infrastructure/homebase/google-drive/dvc_assets.py — isolated DVC subdir bootstrap; exact Drive folder restriction; local-only remote OAuth configuration; one-file explicitly classified track/push/pull; SHA-256 approval binding; no broad push or remove
- infrastructure/homebase/google-drive/test_dvc_assets.py — hermetic tests for path escape, symlinks, classifications, remote mismatch, mutation after approval, exact-object push
- infrastructure/homebase/google-drive/dvc-workspace/.gitignore — local approval manifest not committed
- infrastructure/homebase/google-drive/DVC-SETUP.md — independent host OAuth setup, safe commands, abort path when Google auth blocked

Trust/scope boundary: DVC is not encrypted backup, provider compute, or canonical Money/Overage/Director authority. No private records, owner media or third-party rights-uncleared assets may be uploaded through DVC. Restic/rclone remains for encrypted database backups and separate restoration testing.

Live blockers still open:
1. Machine identity and access to the actual existing Homebase or RunPod checkout.
2. Local host rclone OAuth completion and independent DVC OAuth completion, with credentials stored only on that host/secret manager.
3. A **real** Restic PostgreSQL snapshot and a destructive-safe, isolated database restore test.
4. A real non-sensitive DVC single-file push/pull canary, backed by job receipts and exact hashes.
5. Remote object/MinIO recovery, watchdogs, quota/cost inspection; no production migrations/cancellation before proof.
