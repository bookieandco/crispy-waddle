# JH-PURSE — Owner-operated encrypted source backup kit

**Purpose:** bridge the gap between passing SYNTHETIC restore CI (PR #1466) and a genuine copy of the existing 1.3 GiB-class Jhadina Supabase database. No production database action has been performed as part of this PR.

This script is a **manual local operator tool**, not a scheduled automation or deployed GitHub Action. It is deliberately not run by CI: CI exercises only guard functions and synthetic receipt shapes. The live Supabase project is NEVER accessed from GitHub Actions.

## Why this matters

Live read-only Supabase catalog inspection at 2026-10-22 06:52 UTC reported approximately **1,339 MB** database size; the five Side Hustle commercial tables and six RPCs were still absent. Backup bytes, restore bytes, current owner credentials, or full JWT cross-user acceptance have not been verified. The connected Google Drive \`SWLC-POSTGRES-ENCRYPTED\` folder contained no archive when inspected.

Supabase's current [database backups guide](https://supabase.com/docs/guides/platform/backups) says Pro/Team/Enterprise projects receive physical daily backups and that those may not be directly downloadable. Its documented free-first alternative is a manual logical \`pg_dump\`/CLI export. A database backup does not include the underlying objects stored through Storage API, only DB metadata. Cluster roles/passwords are separately managed.

## Secure local preparation (owner's device or trusted computer)

Prerequisites: PostgreSQL client \`pg_dump\` compatible with the production PG17 server, Python 3, open-source \`age\`, local encrypted-disk space for the 1.3 GB-class database, an **offline preserved** age identity/private key and its corresponding \`age1...\` public recipient. Take care with large table operations; choose a low-traffic window. Do NOT place database credentials, backup ciphertext or decryption keys in GitHub, a public CI secret, or a chat.

A PostgreSQL custom-format dump encrypted on the fly is produced in an existing private local folder with restrictive permissions; plaintext archives are never written by this script. The operator must set these ENVIRONMENT variables privately on their own machine:

- \`JH_PURSE_SOURCE_DSN\` — exact source project's PostgreSQL connection URI with a valid password, database \`postgres\`, and \`sslmode=verify-full\`. Never pass it as a command-line argument or paste it into a GitHub workflow.
- \`JH_PURSE_AGE_RECIPIENT\` — local public age X25519 recipient. Store the private key **separately**, offline. If lost, the backup is unusable.
- \`JH_PURSE_SOURCE_BACKUP_ACK=I_APPROVE_READ_ONLY_ENCRYPTED_EXPORT\` — independent, operator-side acknowledgement.
- \`PGSSLROOTCERT\` if the local PostgreSQL client needs a trusted Supabase TLS root certificate; TLS hostname verification cannot be disabled.

Run on your OWN local computer, not in GitHub Actions:

\`\`\`bash
python3 scripts/purse_owner_offline_backup.py --output-dir "$HOME/private-jhadina-backups" --dry-run
# Owner deliberately removes --dry-run to create the encrypted backup.
python3 scripts/purse_owner_offline_backup.py --output-dir "$HOME/private-jhadina-backups"
unset JH_PURSE_SOURCE_DSN JH_PURSE_SOURCE_BACKUP_ACK
\`\`\`

The directory must exist. The export writes a unique \`.dump.age\` file (custom \`pg_dump\` streamed through age encryption) and an adjacent local receipt with ciphertext SHA-256 and byte size. It cannot delete DB rows, apply DDL, issue grants, sign wallets, spend funds, or modify payout destinations. \`PGOPTIONS\` forces read-only transactions.

## What a successful local receipt DOES and DOES NOT mean

It means the operator's source identity was pinned, TLS verification was required, an encrypted file was saved locally, and a checksum was calculated. It does NOT mean independent restore, source snapshot completeness, backup decryptability, identity / RLS security, or full Supabase platform recovery. It is NOT an authorization permit.

Mandatory *separate* follow-up:
1. Independently transfer/download the encrypted artifact to a separate trusted private machine. Verify the ciphertext SHA-256 against the receipt and successfully decrypt it with the offline age identity.
2. Recreate a **separate nonproduction PostgreSQL 17** cluster, with authorized roles/extensions, and restore the decrypted logical custom-format dump there. Never target the source project.
3. Match source/restored row counts, migrations, functions, grants and hashes; test two authenticated tenant sessions, including SECURITY DEFINER/RPC negative tests.
4. Record signed operator receipts, independent witness and recovery timings, then ask separately for approval to repair the four commercial migrations on the live database.

A custom-format logical export may not capture all project resources: Supabase storage binary objects, external provider data, secrets, custom role passwords or backups in the Management API must be handled independently. **Do not call this a complete production recovery or a restored backup until its full scope is proved.**

Related stack: #1456 → #1460 → #1461 → #1462 → #1466 → this PR. All are draft/read-only; main merge/deployment, paid restoration, production SQL and money moves remain separately approval-gated.
