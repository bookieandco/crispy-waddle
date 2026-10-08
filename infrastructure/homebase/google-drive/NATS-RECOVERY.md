# GOOGLE-HOMEBASE — bounded NATS JetStream disaster recovery

Source: `nats_backup.py`, `nats_restore_drill.py`. This is an **owner-controlled host** capability. The current Homebase is the **iPhone operator UI**, not a NATS server, and the connected ChatGPT Drive token cannot be reused for a NATS/Restic worker.

NATS maintains stream messages and durable consumer state; restoring archived bytes to disk is not a JetStream restoration. The official backup/restore CLI supports a point-in-time stream backup with `--consumers`, offline 2.15 archive validation, and restore into a **nonexistent** stream. Source: https://docs.nats.io/learn/backup-recovery/stream-backup-restore

## Scope and admission controls

- Exactly **one named stream**, never the account or all streams.
- Runs **only** on an existing `OWNER_CONTROLLED` trusted Linux worker. Blocked on hosted GitHub Actions.
- NATS source must be `nats://127.0.0.1:4222`; reject remote URLs, embedded credentials and other ports.
- Requires explicit `JHADINA_NATS_BACKUP_APPROVED=YES` and `JHADINA_NATS_BACKUP_STREAM`.
- Offline archive format currently requires NATS 2.15 **stream.arc.s2**; older `stream.tar.s2` is deliberately refused until a compatible restore is proven.
- Local snapshots capped at 64 files / 128 MiB, with symlinks forbidden.
- Restic encrypts the stream directory to the **existing private Google Drive** Restic repository. The archive is downloaded and checked via per-file SHA-256 and `nats backup validate`; only then is an immutable local receipt issued.
- Restic password and rclone Google OAuth must remain private on the worker, not in Git/PR/comments/logs, and be recoverable independently.

## Real worker-only backup

The separate Google Drive OAuth remote must be configured via `rclone`, with `GOOGLE_HOMEBASE_BACKUP_FOLDER_ID` matching its `root_folder_id`. A validated private `RESTIC_PASSWORD_FILE` is required.

Additional local-only settings:

    JHADINA_NATS_BACKUP_TRUST_DOMAIN=OWNER_CONTROLLED
    JHADINA_NATS_BACKUP_APPROVED=YES
    JHADINA_NATS_BACKUP_STREAM=<explicit-tested-stream>
    JHADINA_NATS_BACKUP_SERVER=nats://127.0.0.1:4222

Once the trusted NATS CLI version and source stream are verified:

    python3 infrastructure/homebase/google-drive/nats_backup.py

The receipt is written to `JHADINA_BACKUP_ROOT/receipts/nats-<restic-snapshot-id>.json`. Preserve it privately. It records `nats_api_restore_tested: false` until a separate restoration drill succeeds.

## Real worker-only offline isolated NATS API restoration

Requires a locally installed `nats-server` and compatible NATS CLI, a private Restic repository, and a receipt from the first step. Set:

    JHADINA_NATS_RESTORE_TRUST_DOMAIN=OWNER_CONTROLLED
    JHADINA_NATS_RESTORE_APPROVED=YES

Then run:

    python3 infrastructure/homebase/google-drive/nats_restore_drill.py --receipt <absolute-local-0600-receipt-file>

The drill downloads the *exact* snapshot, re-checks the archive manifest and offline validity, starts a **temporary NATS server bound only to 127.0.0.1 on an ephemeral port** with its own private JetStream storage, restores the stream through the NATS API, verifies the stream exists with at least one message and the expected name, then tears the server down. It never restores into the live NATS server. This tests a single restore path, not production failover.

**Critical remaining limitation:** durable consumer acknowledgment positions are **not** yet compared with pre-backup values; the receipt explicitly leaves `consumer_ack_positions_tested: false`. Before activating NATS production recovery, verify at least one durable consumer's expected delivery and ack floor against a quiesced test stream. Then repeat on the actual stream(s) with owner-controlled receipts and validate application replay/idempotency.

## Fail-closed/live completion boundary

No live NATS command has been observed from this conversation. No owner-controlled worker exposes a shell through ChatGPT here, and installing a separate server is not required merely to review or merge safe source code. Do not claim NATS backup/restore commissioned, disable any queue services, delete a JetStream stream, change canonical database authority, cancel Supabase/RunPod, or mark HOMEBASE.FINAL based only on GitHub tests.

For full recovery, audit **all** streams, stream configs, consumer state/ack floors, JetStream key-value and object stores if used, NATS server/account credentials, and end-to-end replay against business handlers. NATS backup is not interchangeable with a plain directory copy of `/data`.
