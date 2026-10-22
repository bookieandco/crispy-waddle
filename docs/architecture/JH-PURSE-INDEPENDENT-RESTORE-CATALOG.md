# JH-PURSE independent real-data restore catalog acceptance

Stacked on draft [PR #1489](https://github.com/bookieandco/crispy-waddle/pull/1489) (31/31 exact-head CI). This adds a **read-only comparison and operating gate** for when an actual, owner-controlled full database backup becomes available.

## Actual source discovery (2026-10-22 18:49 UTC)
Jhadina Supabase project \`kqbkaozfjubkjevdfvic\` is PostgreSQL **17.6**, approximately **1,336 MB** database size, with **398 public tables**, **27 auth tables**, **8 storage tables**, **3 realtime tables** and **1 vault table**. The active extensions are \`pg_cron\` 1.6.4, \`pg_net\` 0.20.4, \`pg_stat_statements\` 1.11, \`pg_trgm\` 1.6, \`pgcrypto\` 1.3, \`supabase_vault\` 0.3.1, \`uuid-ossp\` 1.1 and \`plpgsql\` 1.0. Catalog role metadata also records role-based RLS / bypass boundaries. Four historic commercial migration records, five commercial tables and registered Coffers remain absent. There is no real encrypted backup in the connected \`SWLC-POSTGRES-ENCRYPTED\` Drive folder and no independent real-data restore. **These are source catalog observations, not a backup.**

## Why plain postgres:17 is NOT sufficient
The previous synthetic CI uses stock PostgreSQL 16 and handcrafted mocks. The real live database has Supabase-specific extensions, schemas, role semantics, Vault, networking and cron jobs. An ordinary \`postgres:17\` Docker container may lack them; restoring real data may activate jobs, leak Vault secrets, or fail due to missing role ownership/extensions. Never restore actual source bytes to a public, network-connected or uncontrolled instance. Never run real production data in CI. Disable isolated target scheduled tasks/outbound network, initialize supported versions/roles in an owner-controlled offline PG17 target, and separately verify external storage objects.

## Operator-only source vs restored inspection
Use \`scripts/purse-independent-restore-catalog.sql\` against the *live source in a read-only session*, then against a separately isolated, restored PostgreSQL 17 database. The SQL only collects names, versions, RLS/policy drift fingerprints, core role flags, and migration version/name pairs. It DOES NOT read or transmit customer rows, stored secrets, or personal data. Save each single JSON line privately on the operator's computer (do not upload to GitHub, CI, public Drive or chat). Source and restored catalogs must reflect one bounded backup snapshot: running at different dates/times can create legitimate drift. Never use catalog equality as proof of a complete record-level restore.

\`\`\`bash
# Operator-prepared local environment: source and isolated restore connections
# must already be configured securely. Never paste their credentials into chat.
PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$SOURCE_DB_URI" -X -A -t -v ON_ERROR_STOP=1 \
  -f scripts/purse-independent-restore-catalog.sql > private-source-catalog.json

PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$ISOLATED_RESTORE_DB_URI" -X -A -t -v ON_ERROR_STOP=1 \
  -f scripts/purse-independent-restore-catalog.sql > private-restore-catalog.json

node scripts/purse-independent-restore-catalog.mjs \
  private-source-catalog.json private-restore-catalog.json
\`\`\`

This code **never** opens a database connection; it only evaluates two local JSON files. It rejects missing PG17 metadata, source-target extension/RLS/policy/role/migration differences, and permanent blockers if the catalogs appear equal.

## Conditions to authorize a later production migration (NOT satisfied here)
1. Actual owner-operated encrypted source archive and private SHA-256 receipt, independently copied/decrypted by an authorized operator; full storage and custom-role limitations documented.
2. Independently verified **real** PostgreSQL 17 restore with matching provider extensions, roles, exact source-vs-restored row counts and data hashes, immutable signed restore transcript/receipts, and Vault/cron/outbound network containment.
3. At least two real authenticated JWT owner contexts; test denied cross-owner row reads AND SECURITY DEFINER RPC paths. Merely setting app.user_id in PostgreSQL is a synthetic rehearsal, not actual JWT acceptance.
4. An explicitly approved, reviewed migration sequence for the *four already-authored* commercial migrations; do not rewrite historical migration records as a shortcut. Real production grants and data readback only after independent restore and separate owner permission.

## Never auto-authorize
Even 100% catalog parity always returns \`independentRestoreVerified=false\`, \`canApplyProductionDDL=false\`, \`canDeploy=false\`, \`canMoveMoney=false\`. A passing local catalog comparison is a preliminary *negative-drift diagnostic*, never financial or production acceptance. The consolidated #1489 code remains draft/unmerged while live production permissions are reserved.
