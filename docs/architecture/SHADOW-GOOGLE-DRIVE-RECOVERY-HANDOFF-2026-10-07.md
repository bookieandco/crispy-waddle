# SHADOW-GDRIVE.1–.4 — encrypted paper-learning ledger recovery handoff

**Scope:** Jhadina/SHARK Shadow, separate local RunPod PostgreSQL. **Intent:** use the existing, private Google Drive `JHADINA-HOMEBASE / 04-SUBSYSTEM-ARCHIVES / SHADOW-PAPER-TRADING / 01-LEDGER-SNAPSHOTS` as an offsite recovery destination, NOT as a PostgreSQL engine, agent scheduler, trade executor or production cutover.

## Actual status

- Google Drive destination exists. ChatGPT Drive connector created its five children, and an audit/migration Google Doc was saved under `05-MIGRATION-HANDOFF`.
- The previous Shadow watchdog returned `SHADOW_WATCHDOG_NO_RUNNING_POD` and skipped health verification; SWLC recovery returned HTTP 500 and skipped import. **No source database is currently available to this GitHub/Google Drive connection.**
- The source implements Shadow paper decisions, simulated executions, outcome observations, counterfactual lessons, calibration and learning memory. It does not confer live-money authority.
- The current code is a **protected manual archive/restore interface and hermetic tests**, not proof of a live database backup, machine OAuth, recovery or operational commissioning.

## Added in this sequence

- `infrastructure/homebase/google-drive/shadow_backup.py` reuses the Homebase Restic/rclone validation without broadening the DVC asset provider. It accepts only an approved existing Shadow **local PostgreSQL Unix socket** and creates `pg_dump -Fc` backups.
- It encrypts with Restic before Drive, retrieves the immutable exact snapshot, checks restored SHA-256 and `PGDMP` custom dump bytes, and only then creates a 0600 local receipt.
- `restore-drill` restores into the existing **network-isolated, disposable PostgreSQL** implementation and checks that all nine canonical `runpod_shark_shadow_*` / `runpod_shadow_*` ledger tables are present in `public`. It does not modify active databases.
- Hermetic unit tests cover admission, local socket requirement, bad dumps, failed restores, receipt permissions, separate repository path, and schema checks.
- No public GitHub Actions job is authorized to read the private production dump; no new paid compute is requested.

## Host-only operation (AFTER a previously authorized existing Shadow runtime is actually available)

The current user control surface is an iPhone; do not attempt to run PostgreSQL, Restic or rclone on the iPhone. Configure a trusted, existing Linux worker **separately from the ChatGPT Google Drive connector**. Do not place Google OAuth, Restic passphrase, or database secrets in GitHub, Drive handoff documents, chats, CI logs or unencrypted DVC.

1. On the worker, configure one rclone Google Drive remote (example name `jhadina-shadow`), with `type=drive` and `root_folder_id` set to the **exact private `01-LEDGER-SNAPSHOTS` folder**. The script checks both fields. Do not use a broad My Drive root.
2. Protect a recoverable Restic passphrase in a separately escrowed **0600 absolute file**. Install local `pg_dump`, `restic`, and `rclone`; confirm the existing `SHARK_SHADOW_DATA_DIR/socket/.s.PGSQL.<port>` really belongs to the approved Shadow PostgreSQL. The canonical bootstrap uses database `jhadina_shadow`, user `jhadina_shadow_pg`, and local port `55432` unless explicitly configured on the real host.
3. Set these variables *locally on the trusted worker only*, not on the phone or GitHub-hosted Actions:

   ```sh
   export JHADINA_HOMEBASE_TRUST_DOMAIN=OWNER_CONTROLLED
   export SHADOW_DRIVE_BACKUP_APPROVED=YES
   export SHARK_SHADOW_DATA_DIR=/workspace/jhadina/shark-shadow
   export GOOGLE_HOMEBASE_RCLONE_REMOTE=jhadina-shadow
   export GOOGLE_HOMEBASE_BACKUP_FOLDER_ID='<exact-private-01-LEDGER-SNAPSHOTS-folder-ID>'
   export RESTIC_PASSWORD_FILE='<owner-only-0600-absolute-path>'
   export JHADINA_BACKUP_ROOT='<owner-only-absolute-backup-root>'
   python3 infrastructure/homebase/google-drive/shadow_backup.py doctor
   ```

4. After `doctor` succeeds, only if the target `shadow-postgres-restic-v1` repository does not already exist, initialize it **once** through the owner's local, reviewed Restic command: `restic -r rclone:jhadina-shadow:shadow-postgres-restic-v1 init`. If the repository exists, do not reinitialize or overwrite.
5. Execute `python3 infrastructure/homebase/google-drive/shadow_backup.py backup-db`. Preserve the exact `shadow-<snapshot>.json` private receipt, SHA-256, and passphrase recovery copy.
6. Validate `python3 infrastructure/homebase/google-drive/shadow_backup.py verify --receipt '<private-receipt-path>'`. Verify is a restored-bytes proof only.
7. On the **same owner-controlled trusted worker**, with the PostgreSQL 17-alpine Docker image already pulled, set `JHADINA_RESTORE_TRUST_DOMAIN=OWNER_CONTROLLED` and `JHADINA_RESTORE_APPROVED=YES`, then execute `python3 infrastructure/homebase/google-drive/shadow_backup.py restore-drill --receipt '<private-receipt-path>'`. The drill refuses production targets and exits after checking all required tables.

## Invariants / unfinished gates

- **No original data deletion or service migration** before a live encrypted backup, independent byte rehydrate, exact-table restore and learning-row semantic comparison are proven.
- Backups and checksums alone do not prove no missing rows, complete 15m/1h/4h/24h/3d/7d evidence, or correct calibration. A row-count, relationship, timestamp/authority invariant audit on the disposable database is the next independent gate.
- The known RunPod *current-price-as-overdue-horizon* grading defect remains unresolved by backup storage; repair that before claiming high-confidence performance learning.
- Restore-drill's `required_shadow_tables_verified=true` describes table-name presence only; it is not market-data integrity, learning profitability, queue acknowledgement, or all subsystem recovery.
- Pending SWLC recovery is not authorization to import/acknowledge evidence; keep the separate protected importer and queue semantics.
- **Never** direct private Shadow data to `07-DVC-VERSIONED-ASSETS`, public Drive links, or an ephemeral hosted CI/Colab runner without a fresh governance review; this path is for encrypted Restic snapshots only.
- No automated timer, retention prune, funded RunPod provisioning, cloud provider cutover, or live-trading privilege is added.

**Suggested follow-on:** `SHADOW-GDRIVE.5` trusted host/OAuth commission (or fail closed when no host exists) → `.6` exact encrypted snapshot → `.7` isolated restore + semantic table/row checks → `.8` schedule and delivered alert → `.9` reconcile SWLC staged evidence without early ack → `SHADOW-GDRIVE.FINAL` only with signed operational receipts.
