# GOOGLE-HOMEBASE — encrypted Drive backup transport

**Current owner environment:** Jhadina's live Swlc/Pupsonstuff databases are hosted Supabase projects; there is no independently verified local Homebase Compose PostgreSQL authority. `backup-db` is NOT a backup of those Supabase projects, and will now refuse execution unless `JHADINA_POSTGRES_BACKUP_SOURCE=LOCAL_HOMEBASE_COMPOSE` is explicitly set on a real approved machine.

**Safe next phone test:** `COLAB-ENCRYPTED-RESTIC-SYNTHETIC.ipynb` tests encrypted upload and restored hash of **only 64 generated random bytes** using an interactive Colab-mounted personal Google Drive directory. It uses a disposable encryption passphrase; it does NOT prove backup key recovery or production database recovery. Review and run the notebook yourself in Colab after source review. Never feed it real/private data.


This optional offsite backup adapter is NOT a new Jhadina runtime and NOT a replacement for live PostgreSQL, MinIO, NATS, or Homebase approval. The canonical Homebase architecture and RunPod burst routes stay intact.

## Scope and safety

- Requires independent rclone Google Drive OAuth on the actual Homebase host, scoped to the existing private JHADINA-HOMEBASE / 01-BACKUPS folder. ChatGPT's Drive connector token cannot be reused by Homebase.
- Encrypts database snapshots using Restic before sending any data to Drive. Never commit RESTIC_PASSWORD_FILE, OAuth tokens, rclone.conf, live .env files, unencrypted dumps, or recovery secrets.
- backup-db runs a consistent PostgreSQL custom-format logical dump through the existing Homebase Docker Compose postgres service. It never copies live PG database files.
- A success receipt needs an exact immutable Restic snapshot ID and a byte-for-byte SHA-256 recovery via Restic dump. Receipts remain LOCAL under JHADINA_BACKUP_ROOT/receipts, mode 0600.
- `backup-db` is scoped ONLY to the explicitly selected **local Homebase Compose PostgreSQL** instance. Separate MinIO and NATS modules exist but are independently scoped; neither validates live MinIO API rehydrate or NATS consumer ack floors. The local PostgreSQL backup does not cover hosted Supabase projects. Restored bytes are not application-level recovery.
- No deletion/pruning, public sharing, production migrations, changes to Supabase/RunPod, or new cloud spend.

## Configure on the actual Homebase machine

1. Install Docker + Compose, Python 3.10+, rclone, and Restic. Start the local Homebase Postgres service; keep its private local env file at infrastructure/homebase/.env.
2. Run rclone config ON HOMEBASE, authorize the Google account you chose for Jhadina, and create a Drive remote named jhadina-drive. Under advanced settings set root_folder_id to the ID of the existing private 01-BACKUPS folder. Read https://rclone.org/drive/#root-folder-id . Do not paste the OAuth token or folder ID into this public repository. Limit permissions and do not enable link sharing.
3. Verify rclone lsd jhadina-drive: works. Store a strong Restic passphrase in a separate absolute path such as /srv/jhadina-secrets/restic-google.pass, chmod 600. Safeguard an offline recovery copy or the backups will be unrecoverable.

Local environment (examples only, not secret values):

    export JHADINA_POSTGRES_BACKUP_SOURCE=LOCAL_HOMEBASE_COMPOSE
    export GOOGLE_HOMEBASE_RCLONE_REMOTE=jhadina-drive
    export GOOGLE_HOMEBASE_RESTIC_PATH=homebase-postgres-restic-v1
    export RESTIC_PASSWORD_FILE=/srv/jhadina-secrets/restic-google.pass
    export JHADINA_BACKUP_ROOT=/srv/jhadina-backups

From the repository root:

    python3 infrastructure/homebase/google-drive/backup.py doctor
    python3 infrastructure/homebase/google-drive/backup.py init
    python3 infrastructure/homebase/google-drive/backup.py backup-db

Run init only once for a genuinely new Restic repo; it fails safely if a repository already exists. backup-db emits a snapshot ID and expected SHA-256 only after a complete encrypted offsite write AND restored-byte hash proof. Verify later with:

    python3 infrastructure/homebase/google-drive/backup.py verify --snapshot SNAPSHOT_ID --sha256 EXPECTED_SHA256

## Offline tests

    python3 -m unittest discover -s infrastructure/homebase/google-drive -p 'test_*.py' -v

Tests are hermetic and mock any provider interaction. They cannot certify a real Google Drive connection on Homebase or PostgreSQL database restore. An actual restore into a **disposable** Postgres environment and application-level readback is required before commissioning full disaster recovery.

## Live acceptance boundary

Do not disable Supabase, move production authority, cancel RunPod, or mark HOMEBASE.FINAL based only on an encrypted byte-restore. First prove independent Homebase OAuth, database restore, MinIO/object recoverability, private receipt retention, scheduling, monitoring, and a cost audit.
