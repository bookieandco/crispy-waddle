# SWLC SAM historical archive — isolated restore acceptance

**Owner-only, no production database writes. Updated October 12, 2026.**
Project `kqbkaozfjubkjevdfvic`, archive table `public.jhadina_sam_versions`.

## Preconditions and separation of duties

1. The V2 Colab exporter in the private JHADINA-HOMEBASE Drive folder must first export a **real** encrypted archive and adjacent `.json` manifest. At time of this handoff only the *synthetic* canary is present; **zero production SAM rows have been transferred**.
2. Keep the encryption passphrase **outside GitHub, Drive, notebook source, chat logs and CI**. Run the exporter privately from the user's own authenticated Colab connection. No credential should be placed in the repository.
3. Obtain the resulting ciphertext and JSON manifest through an **independent authenticated Google Drive download** onto a trusted computer. Independently record the Drive file IDs and downloadable-byte SHA-256; the exporter's own manifest is not proof of file origin.
4. Run the **content verification** with `swlc_sam_archive_verify.py`. It rejects unexpected schema, invalid GCM tag, tampered ciphertext, duplicate IDs, missing CSV rows, malformed snapshots and cutoff violations. It does **not** prove backup provenance or PostgreSQL restore.
5. Run `swlc_sam_isolated_restore.py` against a disposable **local PostgreSQL 17** database named **exactly** `swlc_archive_sandbox`, reachable only on `127.0.0.1`. This verifier uses only a temporary SQL table. There are no writes to Swlc or public application schemas.
6. Independent review must compare an approved timestamped **source snapshot** and restore receipts. The archive alone is not a full physical database backup. The temporary restore is an additional confidence check, not permission to delete source data.

## Local sandbox instructions (Mac/Linux with Docker available)

Start a disposable sandbox using synthetic-only/local credentials. **Never provide a production PostgreSQL connection string to the restore tool.**

```sh
docker run --rm -d --name swlc-sam-restore-sandbox \
  -p 127.0.0.1:55432:5432 \
  -e POSTGRES_DB=swlc_archive_sandbox \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=local-sandbox-only-passphrase \
  postgres:17
```

Use a private Python 3.12 environment, then install the same verified dependencies from PR CI:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install 'cryptography==46.0.4' 'psycopg[binary]==3.2.10'
python scripts/swlc-drive-archive/swlc_sam_isolated_restore.py \
  --archive /private/path/to/real-sam-history.csv.gz.aesgcm \
  --receipt /private/path/to/real-sam-history.csv.gz.aesgcm.json \
  --local-port 55432
```

The script asks separately, without echo, for the encrypted archive passphrase and the **local sandbox password**. If the source archive doesn't exist yet, these commands **must not** be described as proof of a real restore. The source connection is not opened by this command.

Clean up the disposable instance after review:

```sh
docker stop swlc-sam-restore-sandbox
```

The script returns `localTempPostgresRestoreVerified=true` only after a real CSV COPY into the sandbox succeeds and row count, uniqueness and cutoff conditions are reconfirmed. It **always** returns `sourceDeletionAuthorized=false`, `productionRestoreVerified=false`, `originalSwlcSourceAuthenticated=false`, and `spaceReclaimed=false`. An isolated temp-table replay does not reconstruct application schema, FK links, storage buckets, RLS, indexes or Jhadina services.

## Open gates that remain mandatory

- Swlc remains in `transaction_read_only=on` state and is over the Free-plan database limit. Read-only export could work but has not yet been run.
- Version-history records link to the SAM catalog by FK. Archive a complete parent/child dependency inventory and retention/legal requirements before designing any real removal.
- Independent download SHA-256 is a different receipt from the mounted Drive readback or the operator-generated manifest.
- **Do not** perform any `DELETE`, `TRUNCATE`, `VACUUM FULL`, automatic read/write escalation, billing changes, database migration push or scheduler activation on this evidence alone.
- Schema restoration, independent source evidence and safe space reclamation remain future controlled milestones.

References: [Swlc capacity P0 #1110](https://github.com/bookieandco/crispy-waddle/issues/1110), [Archive PR #1229](https://github.com/bookieandco/crispy-waddle/pull/1229), [Google Drive archive folder](https://drive.google.com/drive/folders/1b-DZZOwzzavYS-7uh8qIi7vgZeR9QnyD).
