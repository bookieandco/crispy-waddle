# DB-RECOVER.01–.08 — Operator execution and release evidence

As of October 14, 2026 PDT / October 15 UTC.

**Status: CODE/READ-ONLY INVENTORY IMPLEMENTED. LIVE RECOVERY BLOCKED.** No independently verifiable current SWLC source dump, isolated restore, owner-reviewed repair plan, authenticated two-owner live test or production SQL approval has been proven. No production SQL writes have been run.

Draft PR: https://github.com/bookieandco/crispy-waddle/pull/1275
Audit/repair issue: https://github.com/bookieandco/crispy-waddle/issues/1276

## Milestone status

| Stage | Implementation and verification | Status |
| --- | --- | --- |
| .01 | Repo SQL hash inventory and 365 remote migration-history records, pinned snapshot | Read-only complete, history conflict remains |
| .02 | Eight duplicate timestamp versions and remote name/type drift inventory | Identified, not resolved |
| .03 | Immutable tracked SQL byte/filename audit in GitHub CI | Code-ready; a changed source file requires explicit re-baseline |
| .04 | Sixteen representative collision object catalog checks, 8 present / 8 absent | Read-only complete; objects do not prove migration execution |
| .05 | `scripts/db-recover-05-backup-bundle.mjs` verifies roles/schema/data SQL byte SHA-256 and prevents symlinks | Code ready; actual SWLC backup still missing |
| .06 | `scripts/db-recover-06-disposable-restore-plan.mjs` constructs a guarded local-only psql plan, NEVER executes it | Plan ready; actual restore and postrestore tests not run |
| .07 | `scripts/db-recover-07-postrestore-readonly.sql` reads catalog existence, RLS, policies and role grants | Executed read-only on SWLC: all five commercial tables absent |
| .08 | `scripts/db-recover-08-release-decision.mjs` checks pinned history, live table state, backup/restore claims and owner approval | BLOCKED; intentionally cannot grant production authority |

## Actual SWLC status

A read-only PostgreSQL catalog check at **2026-10-15T04:41:39.3808+00:00** found NONE of the five canonical commercial tables: work orders, commercial receipts, commerce records, commissioning evidence and Digital Product Studio records. No RLS policies can be certified for missing tables. The remote recorded migration history contains **365 versions**; four essential commerce migration versions are absent. The checked repo snapshot has **223 SQL files with 215 unique versions and eight duplicate timestamps**. These are historical facts as of their respective read-only observations, not authorization to run missing SQL.

## Actual backup collection (not yet performed)

Supabase official documentation recommends separate roles, schema and data dumps using its CLI, not a blanket raw pg_dump of internal objects:
https://supabase.com/docs/guides/self-hosting/restore-from-platform

An authorized operator on a device with Docker + the Supabase CLI and an owner-supplied SWLC database connection should export:

```sh
# Never paste the connection string into GitHub, chats or logs.
supabase db dump --db-url "$PRIVATE_SWLC_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$PRIVATE_SWLC_DB_URL" -f schema.sql
supabase db dump --db-url "$PRIVATE_SWLC_DB_URL" -f data.sql --use-copy --data-only
```

Do not infer this is a complete business backup without also reviewing the Storage **object bytes**, Edge Functions, extensions, auth/SMTP/OAuth configuration, file access permissions and a measured restore. Encrypt and retain the original dump in an owner-controlled private archive. Do not commit the SQL files, database URL, JWT/API keys, authentic customer records, or generated manifest to GitHub.

To create and validate a **private draft SHA manifest** from those real local files:

```sh
export DB_RECOVER_BACKUP_BUNDLE_DIRECTORY=/path/to/private/backup-bundle
export DB_RECOVER_BACKUP_CAPTURED_AT=2026-10-15T04:45:00Z # replace with ACTUAL capture time
node scripts/db-recover-05-backup-bundle.mjs --draft-local-manifest > /path/to/private/backup-manifest.json
# A matching SHA is NOT evidence of source authenticity or restored rows.
```

The capture time must be the real timestamp; the illustrative value above must not be retained. Obtain a separate independent operator's source/export verification and archive integrity signature before trusting the backup.

## Disposable restore plan and real test (not yet performed)

Only use a genuinely owner-controlled throwaway local PostgreSQL/Supabase database, already created with the appropriate authentication/extension bootstrap. Database name **must** match `biz_purse_recovery_*`; host must be loopback; the script never accepts an ordinary remote SWLC URL.

```sh
export BIZ_PURSE_LOCAL_CONFIRMATION=YES_DISPOSABLE_DB_ONLY
export BIZ_PURSE_DISPOSABLE_DATABASE_URL='postgresql://postgres:LOCAL_PASSWORD@127.0.0.1:54322/biz_purse_recovery_case'
export DB_RECOVER_BACKUP_MANIFEST=/path/to/private/backup-manifest.json
export DB_RECOVER_BACKUP_BUNDLE_DIRECTORY=/path/to/private/backup-bundle
node scripts/db-recover-06-disposable-restore-plan.mjs --plan-local-only
```

**The command ONLY prints a restore plan and does not execute.** An authorized local operator must inspect the source SQL, local target and connection before separately running `psql` with the planned arguments. Verify its `--single-transaction` exit status, SQL row-counts, extensions, source-vs-restored object definitions and separately transferred Storage blobs. Local tests use `scripts/biz-purse-14-local-owner-test.mjs` and the two-owner SQL fixture; they require actual canonical migrations and auth setup. The `.15` atomic order event PostgreSQL race drill also requires a real isolated instance; its in-memory tests are not database certification.

## Release/no-go criteria

Do not execute production DDL, `supabase db push`, migration-history repair, privilege grants or data changes until an independent reviewer has verified ALL of:

1. Genuine SWLC encrypted dump and source/provider provenance with recorded capture time and archive hash;
2. Distinct disposable restore with actual SQL success, role/function/schema/index/RLS and row-count readbacks;
3. Explicit resolution of eight timestamp collisions, remote-only and repo-only migration histories by original SQL body and dependency; no fictional `migration repair --status applied`;
4. Two-authenticated-user negative and positive RLS tests and SECURITY DEFINER/EXECUTE/search_path review, not just a service role query;
5. Owner-reviewed exact repair SQL hashes, rollback/recovery plan, deployment cost and maintenance window, followed by a separate authorized production action;
6. Fresh independent post-deploy readback confirming all intended tables, RPCs, grants and data consistency.

**Production decision: NO-GO.** Source-code and fixture tests may pass while real restore and commercial operation remain blocked. The repo code intentionally cannot promote its own report to production authority.

## CI

```sh
node --test scripts/db-recover-*.test.mjs
node --test scripts/biz-purse-*.test.mjs
```

The Opportunity Core CI workflow invokes these, but CI is only code integrity, not SWLC restoration or an authenticated client canary.
