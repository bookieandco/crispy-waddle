# SOCIAL-CORE.RECOVER.07 — isolated PostgreSQL acceptance and safe reconciliation

Date: 2026-10-21
Source parent: #1438, `30fae11941e6883592608d7d4cab70dd2265e294`
This draft: #1439 (stacked on #1438), based on #1430 → #1436 → #1438.
No production SQL, auth/session change, OAuth, deployment, publication, DM, ad purchase or spending.

## What passed

A **disposable PostgreSQL 16** job with fixed database
`social_recover_ci`, loopback-only `PGHOST`, and no production secrets
successfully applied the repository's **original real schema migrations**:

1. `20260921214803_jhadina_social_governed_publication.sql`;
2. `20260921230450_jhadina_social_governed_messages.sql`;
3. `20260929014500_transcript_fold_runtime_1.sql` (introduces canary functions,
   with a minimal synthetic opportunity-table dependency).

It then applied the **UNAPPLIED PROPOSAL** from .06 solely to that disposable
database, and executed all of these assertions:

- 19 Social direct write RPCs + the account-binding RPC are inaccessible to
  both `authenticated` and `anon` roles after REVOKE.
- The new `jhadina_social_server_mutation(uuid,text,jsonb)` dispatcher has
  EXECUTE only for `service_role` (not PUBLIC, anon, authenticated).
- The original pre-cutover authenticated receipt RPC is callable, proving
  that the test meaningfully simulates the privilege change.
- Owner A and owner B each see their own synthetic account under the original
  RLS policies; anonymous SELECT is denied or returns zero rows.
- Authenticated owner A and anonymous principals cannot directly invoke the
  protected dispatcher; authenticated owner cannot directly approve a receipt.
- Service-only call creates a receipt under an exact transaction-local owner
  identity; owner B cannot approve or consume owner A's receipt.
- Incorrect fingerprint returns false; correct exact fingerprint consumes once;
  replay returns false; unknown dispatcher operation fails.
- A synthetic publication proposal cannot enqueue an outbox job without a
  consumed matching receipt; the approved-and-consumed exact fingerprint
  permits exactly one pending job, and repeat enqueue is rejected. No provider
  dispatch, network request, publish or message takes place.
- Test never calls a real provider, never generates real content, and rolls
  back synthetic approval transitions.

Evidence: GitHub Actions job
https://github.com/bookieandco/crispy-waddle/actions/runs/39694881972/job/119549732949
(status: success at exact test-script commit `05e59e919565c0c54d752442968c836decfe96cb`).
Scripts: `scripts/social-rpc-postgres-accept.sh`,
`.github/workflows/social-rpc-disposable-postgres.yml`.

## Live READ-ONLY database reconciliation

Jhadina Supabase project `kqbkaozfjubkjevdfvic` was queried **without
making modifications**. The migration-history rows relevant to Social are:

| Applied version | Applied migration name | Source interpretation |
|---|---|---|
| 20260921214803 | jhadina_social_governed_publication | Exact source file exists |
| 20260921215150 | social_prod_schema_reconciliation | Applied version does **not** match canonical repo file |
| 20260921230450 | jhadina_social_governed_messages | Exact source file exists |
| 20260929015104 | transcript_fold_runtime_1 | Applied version differs from canonical repo file `20260929014500` |
| 20260929015555 | transcript_fold_runtime_1_indexes | Index migration applies separately |
| 20260930070033 | social_presence_runtime_1 | Applied version present |

**Important limitation:** successful disposable testing of the repository's
`20260929014500` migration does not establish that its function definitions
match the production's applied `20260929015104` version byte-for-byte.
Compare production `pg_get_functiondef`, RLS/policies/GRANTs, triggers and
schema tables against exact source before generating a canonical migration.
Do not manually rewrite `supabase_migrations.schema_migrations`.

The production account binding, approval, and outbox permission grants
remain unchanged. Source branches #1430/#1436/#1438/#1439 are all
draft/unmerged. No owner/provider token was authorized.

## PR reconciliation order (no merges yet)

1. Rebase the original #1430 source changes onto the latest `main`,
   preserving original security controls, then exact-head CI.
2. Reconcile child #1436 onto the new parent; isolated RLS acceptance for
   Studio persistence is still separate and remains feature-flagged OFF.
3. Reconcile child #1438 (service-authority cutover) and this disposable PG
   acceptance #1439; rerun the full Social/UX/production build gates on the
   final combined exact head.
4. Resolve migration version drift and compare the real production
   schema/privileges before generating a proper Supabase CLI migration.
5. Verify production runtime server secret or OIDC proxy can call the new
   service dispatcher with an authenticated browser user while ordinary
   client JWTs cannot. The disposable service-role test is NOT live OIDC
   or browser login acceptance.
6. Audit the separate Action Core audit-ledger RPC's write privileges and
   verify no direct owner-level policy/approval bypass exists elsewhere.
7. Gate permission changes, feature flags, publication, messaging, and
   any external/provider side effects on explicit operator approval, with
   rollback plan and live owner-only iPhone acceptance.

## Production safety decision

**Staged / NOT commissioned.** Isolated PostgreSQL acceptance passed.
Full system acceptance requires real-runtime credential, owner session,
database drift, Action Core ledger and real-device tests. A passing GitHub
build/READY deployment cannot substitute for these.
