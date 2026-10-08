# GOOGLE-HOMEBASE-LIVE.3 — actual synthetic PostgreSQL/Restic/restore integration

**Scope:** engine-level nonproduction proof; GitHub Actions temporary CPU worker, no external secrets, no real Jhadina data, no new paid server or GPU.

## Why

The existing Homebase safety suite contains unit tests with mocked subprocess and provider calls. Those tests are appropriate for admission gates, but they are **not** proof that a real PostgreSQL dump will successfully decrypt and import into a different PostgreSQL instance. LIVE.3 adds an independent real-engine canary using a fresh disposable database only.

## Implementation

- `infrastructure/homebase/google-drive/synthetic_postgres_restic_drill.py` first requires `JHADINA_SYNTHETIC_PG_APPROVED=SYNTHETIC-ONLY`, rejects `DOCKER_HOST` remote endpoints, nondefault Docker contexts, and inherited production database/provider settings.
- An ephemeral `postgres:17-alpine` container is started with **`--network=none`** and no published ports; a table and 32-character random canary marker are created inside that container.
- `pg_dump -Fc` exports **only that newly generated data** into a private scratch folder. The source container is removed.
- The job creates a **brand-new local Restic repository** with a fresh temporary private passphrase. It encrypts the dump using `restic backup --stdin` with `jhadina-postgres.dump`; it retrieves the exact immutable snapshot and compares full SHA-256 / bytes.
- Then the existing `restore_drill.restore_into_disposable_postgres` creates a different offline container, executes a real `pg_restore`, and verifies application tables exist. Its own cleanup path removes that container.
- The job prints only a synthetic receipt. It explicitly records `offsite_drive_backup_verified=false`, `supabase_live_data_covered=false`, and `production_backup_restored=false`.

The integration workflow `.github/workflows/google-homebase-synthetic-pg.yml` runs on PR changes to this script/workflow and by manual dispatch. It installs Restic and pulls the public Postgres test image in a GitHub-hosted ephemeral runner; no production secrets, Google Drive OAuth, Supabase, MinIO, NATS or RunPod access are involved. GitHub Actions minutes and public image bandwidth apply, but no new instance/subscription is purchased.

## Exact acceptance

**Accept:** real PostgreSQL custom-format dump + local Restic encryption, exact-id decrypt/readback, and isolated PostgreSQL import on generated dummy data.

**Do not accept:** hosted Supabase project recovery, real backup of the production DB, permanent Restic passphrase escrow, Google Drive offsite restore, object-store versions/metadata, NATS consumer ack floors, application-state integrity across domains, or Homebase readiness.

This PR is independently mergeable with LIVE.2; LIVE.2 source guards continue requiring `JHADINA_POSTGRES_BACKUP_SOURCE=LOCAL_HOMEBASE_COMPOSE`. Neither branch changes production authority.

## Evidence and next step

Review the **exact-head** integration workflow's real-engine JSON output and its GitHub job conclusion before claiming test success. A passing mocked unit suite is not sufficient. If the GitHub runner cannot run Docker, report that limitation instead of converting it to a claimed restore.

For real recovery, continue [issue #1144](https://github.com/bookieandco/crispy-waddle/issues/1144) on an existing owner-controlled trusted runtime with separately verified credentials. No confidential backup content is authorized for hosted CI or Colab.
