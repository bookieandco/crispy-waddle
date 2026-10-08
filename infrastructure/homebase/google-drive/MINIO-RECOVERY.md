# GOOGLE-HOMEBASE — bounded MinIO object export (source gate)

This is an **optional single-bucket current-object encrypted archive**, not a MinIO full-service backup, transactional snapshot, object-version history export, or evidence of live Homebase hardware. It reuses the Restic+rclone Google Drive repository and folder-scope enforcement in backup.py. It never changes production object contents or deletes remote objects.

## Security model

- Execute only on an independently authorized, owner-controlled existing Linux worker. The owner's current iPhone is an operator, NOT a MinIO/docker host.
- Does not run under GitHub Actions or any hosted public CI.
- Reads only an explicit named bucket on a MinIO endpoint at `http://127.0.0.1:9000`, via a private MinIO client alias `MC_HOST_jhadinaprivate`. The alias URL includes credentials and **must be supplied by a host secret manager**; never put its value into this repo, issue comments, chat, or action logs.
- Requires `JHADINA_OBJECT_BACKUP_TRUST_DOMAIN=OWNER_CONTROLLED` and `JHADINA_OBJECT_BACKUP_APPROVED=YES` before any remote reads.
- The source inventory is capped at **1,000 objects / 128 MiB per bucket**, with a second key/size inventory comparison after copying; larger datasets fail rather than silently claiming completeness. Cross-file atomicity is **not** guaranteed even if sizes/keys match.
- Copies via MinIO client `mc mirror` into one private temporary folder, computes a SHA-256 manifest of the copied current-object bytes, encrypts a Restic snapshot to the scoped Google Drive repository, downloads/restores the snapshot to a separate scratch directory, and verifies the full manifest.
- Emits a private object receipt with object count, total bytes, manifest SHA-256, and immutable snapshot ID **only after encrypted remote restore verification**. It does not emit object keys or URLs in the receipt.
- No `mc rm`, `mc mirror --remove`, `restic forget` or `restic prune` calls. Never point the alias at a production public endpoint or Supabase storage.

## Trusted worker-only setup

Prerequisites: `mc`, `restic`, `rclone` in PATH; locally authorized `jhadina-drive` rclone Drive remote with `root_folder_id` equal to Jhadina's private 01-BACKUPS folder; `RESTIC_PASSWORD_FILE` mode 0600; existing compatible encrypted Restic repository initialized. The private MinIO alias is set securely through an environment secret—not checked into the repository.

Local environment names (use a secret store rather than shell history for values):

    GOOGLE_HOMEBASE_RCLONE_REMOTE=jhadina-drive
    GOOGLE_HOMEBASE_BACKUP_FOLDER_ID=<private-Drive-backup-folder-id>
    RESTIC_PASSWORD_FILE=<absolute-private-passphrase-file>
    MC_HOST_jhadinaprivate=<private-loopback-MinIO-URL-from-secret-store>
    JHADINA_MINIO_BUCKET=<explicit-small-test-bucket>
    JHADINA_OBJECT_BACKUP_TRUST_DOMAIN=OWNER_CONTROLLED
    JHADINA_OBJECT_BACKUP_APPROVED=YES

From the real worker's repo checkout:

    python3 infrastructure/homebase/google-drive/minio_backup.py

The resulting receipt is LOCAL under `JHADINA_BACKUP_ROOT/receipts/objects-<snapshot>.json`. Protect these receipts and the Restic password with independent recovery copies. A temporary mirror requires adequate trusted-host disk space; limits are a source-side bound, not a guarantee about disk availability.

## Not yet proven

1. Machine-level Google OAuth and `mc` connection on a trusted host.
2. Real Restic round-trip with MinIO (the GitHub tests mock all provider calls).
3. Isolated MinIO **API-level** rehydration including metadata, bucket policies, multipart data, and version history.
4. All buckets, cross-bucket consistency, distributed MinIO topology and historical object versions.
5. NATS JetStream snapshot/recovery, database/MinIO coordinated recovery, retention and delivered phone alerts.

A green test means the **source fail-closed contract** works under mocks; it does not permit decommissioning MinIO, Supabase or RunPod.

## Optional freshness monitoring

After real private receipts exist on the trusted worker, validate both the PostgreSQL snapshot and the **specific** MinIO bucket's encrypted restored-byte archive:

    python3 infrastructure/homebase/google-drive/monitor.py --require-object-bucket <exact-bucket-name>

This returns unhealthy if the PostgreSQL backup is stale OR the selected bucket has no fresh verified object-byte receipt. It never upgrades an object-byte archive to a MinIO API rehydration certificate. The current disabled systemd monitor template checks PostgreSQL only and must not be represented as monitoring every bucket. To monitor multiple buckets, execute individual exact-bucket checks, preserve their distinct failures and implement a real owner-notification delivery route.
