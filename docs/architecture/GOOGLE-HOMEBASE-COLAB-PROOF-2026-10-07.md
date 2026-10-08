# GOOGLE-HOMEBASE.6 — first live personal My Drive DVC canary receipt

**Observed window:** 2026-10-07 (owner-local evening, corresponding to Google Drive creation 2026-10-08 UTC). **Scope:** personal My Drive / `JHADINA-HOMEBASE/07-DVC-VERSIONED-ASSETS`, **not** a Workspace shared drive.

## Evidence and precise provenance

1. The owner executed `infrastructure/homebase/google-drive/COLAB-MYDRIVE-SYNTHETIC.ipynb` in an interactive Google Colab session and supplied its final JSON in the chat. It reports:
   - `schema = jhadina.google-homebase.colab-mounted-dvc-canary.v1`
   - `synthetic_bytes = 64`
   - `sha256 = dc1c480a367687cfec18cfb6f7380598f4574fac976a84c2c88d203afbd6a814`
   - `mounted_personal_drive_remote_roundtrip_verified = true`
   - `dvc_gdrive_plugin_authenticated = false`
   - `machine_google_oauth_verified = false`
   - `production_backup_restored = false`
2. Independent ChatGPT Google Drive connector **metadata traversal** observed one 64-byte file beneath `07-DVC-VERSIONED-ASSETS/_JHADINA_COLAB_SYNTHETIC_DVC/files/md5/33/`. The existence and size of the uploaded object were independently visible.
3. The complete 64-byte SHA-256 byte comparison and remote-only `dvc pull` are **owner-reported Colab program output**; they were not independently recomputed by ChatGPT. Do not reinterpret Drive metadata as cryptographic proof by itself.
4. The dedicated recovery contract and broader Jhadina CI passed on the PR commit previously examined. Recheck exact-head CI after source changes before merge.

## Acceptance boundary

- **Accepted:** First owner-observed end-to-end **synthetic** DVC round trip using a Colab-mounted *personal My Drive directory* as the DVC remote. No new server required.
- **Not accepted:** DVC `gdrive://` API plugin authentication, unattended Google OAuth, worker authorization, Restic password recovery, PostgreSQL database rehydrate, MinIO API restore/version history, NATS consumer acknowledgment recovery, backup schedules, owner alerts, business-subsystem E2E, or HOMEBASE.FINAL.
- **No authority change:** iPhone remains an operator; no Supabase, RunPod or paid GPU decommission/creation. The synthetic object is harmless; no remote deletion authorized.

## Next evidence-gated steps

1. Complete source audit and exact-head tests; merge source PR #1139 when review/CI policy is met.
2. Identify an already trusted, owner-controlled persistent runtime for *private* Restic credentials and confidential backup operations. A hosted public GitHub runner and ephemeral personal Colab are **not** accepted as production private backup authorities.
3. Test scoped machine Google OAuth on that runtime, then encrypted remote upload and checksum restore, PostgreSQL isolated pg_restore, MinIO API-level recovery, NATS consumer ack-floor replay, schedule and failure notification.
4. Preserve the existing Supabase/RunPod providers until real equivalent state/compute recovery and complete end-to-end canaries pass.
