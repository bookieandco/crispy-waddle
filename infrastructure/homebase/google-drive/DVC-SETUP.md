# GOOGLE-HOMEBASE.3 — DVC + Google Drive commissioning

**CURRENT DEVICE: iPhone only. Do not run these Python/Docker/OAuth commands on the phone.** These are future commands for an independently provisioned, authorized worker/host. ChatGPT's Drive connector already permits separate manual operations from the phone; it does not provision that host. See docs/architecture/PHONE-HOMEBASE-GOOGLE-STAGING-2026-10-07.md.

The Homebase PostgreSQL/MinIO/NATS services remain canonical. Encrypted database disaster recovery uses backup.py (Restic+rclone), NOT DVC. DVC with dvc-gdrive is optional, versioned, non-sensitive asset transport for cleared datasets, model weights, Director outputs and approved experiments. DVC does not supply GPU processing, live database services or encrypted backup.

Source: https://github.com/treeverse/dvc and https://github.com/treeverse/dvc-gdrive

## Prerequisites — not yet observed live

- Owner has authorized Google access on the actual Jhadina host; the ChatGPT connector OAuth cannot be reused there.
- Install Python and Git, create a private virtualenv, and run: python -m pip install dvc dvc-gdrive
- Set GOOGLE_HOMEBASE_DVC_FOLDER_ID to the exact ID of the private 07-DVC-VERSIONED-ASSETS folder previously created in JHADINA-HOMEBASE. Keep OAuth credentials, refresh tokens and keys outside Git.
- Use an actual Git checkout of crispy-waddle, so dvc init --subdir can find the parent Git repository.

## Commands from the repo root on the host

    export GOOGLE_HOMEBASE_DVC_FOLDER_ID='<EXACT_FOLDER_ID_FROM_DRIVE>'
    python3 infrastructure/homebase/google-drive/dvc_assets.py doctor
    python3 infrastructure/homebase/google-drive/dvc_assets.py bootstrap

Bootstrap is idempotent and refuses to overwrite a remote pointing to a different folder. The remote URL and OAuth profile stay in local-only DVC configuration. Bootstrap does not authenticate or upload. On the first DVC push, Google authorization is requested, independent from the ChatGPT connector.

If the default DVC Google authorization app is blocked, stop and create a dedicated OAuth client following https://dvc.org/doc/user-guide/data-management/remote-storage/google-drive ; do not bypass security. For Restic/rclone headless OAuth use https://rclone.org/remote_setup/. A service account with explicitly granted folder permissions is a possible alternative. Never paste tokens, service-account JSON, Restic passwords, or DVC config.local into GitHub, Actions or chat.

## Explicitly approved single-asset workflow

1. Place a file already cleared for cloud storage under infrastructure/homebase/google-drive/dvc-workspace/assets/ (e.g. approved-model.bin). Do not stage private claimant, financial, personal, copyrighted third-party, or production secret data.
2. Record its non-sensitive classification and subsystem:

    python3 infrastructure/homebase/google-drive/dvc_assets.py track --asset approved-model.bin --classification CLEARED_NON_SENSITIVE --subsystem director

3. Inspect git status; only commit generated DVC pointer and workspace metadata after review. The local approval manifest stays ignored.
4. Push exactly that file:

    python3 infrastructure/homebase/google-drive/dvc_assets.py push --asset approved-model.bin

This requires the file bytes still matching the local approved SHA-256, the exact expected Google folder, a safe path, and its DVC pointer. No broad pushes, automatic publication, remote cleanup, or DVC garbage collection.

Restore the appropriate DVC metadata version from Git then run:

    python3 infrastructure/homebase/google-drive/dvc_assets.py pull --asset approved-model.bin

A successful DVC pull is not a production backup/restore certificate. DVC Google Drive remotes verify downloaded hashes by default.

## Source validation

    python3 -m unittest discover -s infrastructure/homebase/google-drive -p 'test_*.py' -v

## Acceptance

Source coverage is separate from live certification. Prove distinct host OAuth, one approved DVC push/pull, real encrypted Restic+Postgres disposable restore, MinIO object restore, complete CI and provider cost audit before changing Supabase, RunPod or Homebase authority.
