# GOOGLE-HOMEBASE — serverless synthetic DVC canary from iPhone

This is a **GitHub-hosted ephemeral runner option** for one tiny, non-sensitive DVC upload and download to Jhadina's private 07-DVC-VERSIONED-ASSETS Google Drive folder. It does **not** need a new VPS/RunPod/GPU/Homebase machine. It does use GitHub Actions minutes, and Google API/storage quotas apply. No provider pricing/free tier is asserted.

The workflow is `.github/workflows/google-homebase-dvc-synthetic.yml`, and it is **manual dispatch only**. It never runs on push, pull request, schedule or a fork. A valid run requires selecting `SYNTHETIC-ONLY`, a protected environment, one scoped Google service account with its JSON key stored in a GitHub environment secret, and a correctly configured folder ID. Do not confuse this with the authenticated ChatGPT Drive connector (different OAuth).

## One-time setup from iPhone browser

1. The user or administrator must own or control a Google Cloud project authorized to use Google Drive API. Enable the Drive API if necessary, and create a **dedicated service account for this synthetic test only**. A Cloud project may have separate policy requirements. Do not create a billable service or grant organization-wide permissions.
2. In Google Drive, share **only** the existing private `07-DVC-VERSIONED-ASSETS` folder with that service account's `...gserviceaccount.com` address as Editor. Do not share `01-BACKUPS`, personal files, Jhadina customer records, or the entire Homebase parent folder.
3. In GitHub `bookieandco/crispy-waddle`, use Settings → Environments → create `google-homebase-synthetic`. Enable required reviewer protection if your plan supports it. Store `GOOGLE_HOMEBASE_DVC_SA_JSON` as an **environment secret**, containing the downloaded service-account JSON. Never paste the key into ChatGPT, code, Issues, PR comments, GitHub variables, or Actions logs.
4. Add an **environment variable** `GOOGLE_HOMEBASE_DVC_FOLDER_ID` set to the exact Drive folder ID. This is a folder locator, **not** a token. Never set the parent Homebase folder ID.
5. After PR #1139 is reviewed and merged, in GitHub Actions choose **Google Homebase synthetic DVC proof**, choose `SYNTHETIC-ONLY`, and run once. If required environment approval appears, approve only after confirming workflow head and secret scope.
6. Check the run's final JSON proof and confirm it reports `remote_only_restore_verified: true`. It will also explicitly report `full_runtime_google_oauth_verified: false` and `real_database_recovery_certified: false`—those cannot be inferred.

For avoiding long-lived JSON keys, workload identity federation is preferable when independently commissioned and tested; this scaffold currently requires a GitHub environment secret and should be rotated/revoked after commissioning if it is no longer needed.

## Safety and limits

- Code generates **64 random bytes** in a private scratch DVC workspace. It uploads that one tracked file, deletes **only that scratch DVC cache**, re-downloads it from the private Drive remote, and verifies SHA-256. No production asset, user document, media upload, PII, financial data, MinIO bucket, NATS stream, or database dump is used.
- No `dvc gc`, remote delete, Docker, Postgres, RunPod, or outbound publication step.
- `ci_synthetic_dvc.py` demands GitHub manual dispatch on the exact Jhadina repo, and validates the presence and type of a service account secret. It creates a temporary `0600` key file on the transient runner, which is deleted with its temporary directory. Credentials must never be stored in Git.
- DVC and `dvc-gdrive` are installed at dispatch time, so the workflow uses **networked supply-chain dependencies**. Pin and approve tested package versions before relying on the workflow for anything beyond a synthetic canary.
- The service account must actually be granted the destination folder. A successful ChatGPT Drive connection does not grant this service-account permission.
- Service accounts can have Google Drive quota/ownership limitations; if the canary fails due to account policy or storage quota, record it as a blocker. Do not widen permissions to fix it automatically.
- A completed synthetic canary proves only that **this GitHub-runner service account** can upload/download one tiny file. It does **not** prove a dedicated always-on Jhadina runtime, DVC for sensitive files, encrypted Restic PostgreSQL/MinIO/NATS recovery, or domain migration.
- A hosted CI runner must never be used with real private Homebase backups. Those remain on an owner-controlled trusted host. The iPhone continues as the user-facing control device.

Official DVC Google Drive docs: https://dvc.org/doc/user-guide/data-management/remote-storage/google-drive
