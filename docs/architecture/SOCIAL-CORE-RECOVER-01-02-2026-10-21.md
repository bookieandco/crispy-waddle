# SOCIAL-CORE.RECOVER.01–.02 — live read-only audit and staged security repair

Date: 2026-10-21
Source baseline: `main@b1b9c277748f5f88f8dd6df50d6cbeeb6c7902b8`
Supabase inspected: Jhadina project (SWLC), `kqbkaozfjubkjevdfvic`
Production mutation status: **NONE**. No SQL migrations, accounts, tokens,
posting, spending, or Vercel deployment were performed by this recovery branch.

## Live evidence: previous outage resolved

- `SELECT current_database(), now()` and Postgres catalog queries succeeded.
  Previous `57P03` recovery reports are historical; do not claim it is down.
- 12 `jhadina_social_*` tables in `public`: accounts, approval_receipts,
  contact_states, content_projects, message_outbox, message_proposals,
  observations, outbox, platform_receipts, publication_proposals,
  publication_targets, publish_canaries.
- All 12 social tables reported `rowsecurity=true`. Owner RLS read policies
  were inspected, but a second signed-in owner/anonymous denial test has
  **NOT** yet been performed.
- Observed row counts: accounts=0, content_projects=0,
  publication_proposals=0, publication_outbox=0, observations=0,
  message_proposals=0, platform_receipts=0.
- The public schema contained **zero creator-named tables**; the
  `20261016140000_jhadina_creator_campaign_records.sql` work from draft
  Social-Free #1328 is not present in the checked migration history.
- Source migration `20260921214803_jhadina_social_governed_publication.sql`
  appears in applied history. The older duplicate
  `20260921010000_jhadina_social_governed_publication.sql` does **not**.
- Source migration `20260921223500_social_prod_schema_reconciliation.sql`
  differs from the applied entry `20260921215150_social_prod_schema_reconciliation`.
  Do not assume equivalent SQL solely from the name or manually edit
  migration history. Compare checksums / definitions before producing
  the eventual canonical CLI migration.
- Applied `20260921230450_jhadina_social_governed_messages` is present.

## High-priority security findings

1. `authenticated` had EXECUTE on
   `public.jhadina_social_upsert_account(text,text,text,text,text,text)`,
   a `SECURITY DEFINER` procedure that inserts/updates
   `jhadina_social_accounts.status='connected'` based on client-supplied
   provider/profile identifiers. It checks `auth.uid()` but **not** provider
   ownership. The protected Next.js API performs provider discovery, but the
   database RPC is independently callable, bypassing that verification.
2. `authenticated` also has broad table privileges (including TRUNCATE on
   several Social tables), even when RLS restricts DML. Least-privilege grants
   should remove unnecessary rights rather than rely on RLS for them.
3. Supabase Security Advisor reported 35 `authenticated`-executable
   `SECURITY DEFINER` function warnings project-wide, with multiple
   Social receipt/outbox functions included. Direct inspection confirms
   Social approval receipt creation, approval and consumption are reachable
   under the authenticated role. Their owner/fingerprint checks exist but
   do **not** establish that direct RPC calls passed Action Core server policy.
   This is a separate P0 *authorization-flow verification* item; no
   exploit/publication was attempted or established.
4. Content Studio drafts are ephemeral browser state; this branch deliberately
   does not claim to solve creator storage, media rendering, or live publishing.

## .01 staged code change

- `createSocialRepository().registerAccount()` now re-verifies exact
  authenticated user, rejects a user mismatch, requires
  `JHADINA_SOCIAL_ACCOUNT_BINDING_HARDENED=true`, then uses the existing
  privileged server-only Supabase client (service key or production OIDC
  proxy) to bind the exact provider profile discovered by the authenticated
  `/api/social/profiles` route. It no longer invokes the user-callable RPC.
- If the privileged client or commissioning flag is absent, registration
  fails closed. Returned owner/brand/provider/profile/platform/status are
  checked before claiming `connected`.
- The route redacts internal account-binding failures and returns a clear 503
  if the cutover is not commissioned.
- A targeted Vitest file covers migration flag denial, cross-owner denial,
  missing server authority, exact binding and mismatched DB return.
- No owner account registration is enabled by this source alone.

## .02 SQL proposal (NOT APPLIED)

`supabase/proposals/social_core_recover_01_02_UNAPPLIED.sql`:
- revokes user `EXECUTE` from the unsafe account-binding RPC;
- leaves service-only privileges for trusted server-side compatibility;
- revokes unnecessary table DML/TRUNCATE/trigger privileges from eleven
  owner-readable Social tables; regrants only SELECT to authenticated;
- preserves legitimate owner INSERT/UPDATE for
  `jhadina_social_content_projects`;
- fails if required schema/RLS prerequisites are absent.

This file is **not** an executable migration in `supabase/migrations`.
Use the Supabase CLI's `migration new` on an exact reconciled database
to create an actual migration with a conflict-free version. Include explicit
GRANTs and RLS for newly created public tables (relevant to Supabase's
2026-10-30 Data API behavior change).

## Exact safety/acceptance steps before any live promotion

1. On a separate test database, apply proposal after schema/RLS inventory.
   Confirm authenticated can SELECT *only own rows*; anon and a second owner
   cannot read/write another user's data; direct account upsert RPC returns
   permission denied; authenticated cannot TRUNCATE.
2. Verify runtime is on the intended Supabase project, that the service-role
   or OIDC proxy is configured only server-side, and that privileged direct
   account upserts work for an actually provider-discovered exact profile.
3. Verify the provider cannot be impersonated by a crafted request or a
   different owner. Test revoke/reconnect, wrong brand/profile, and DB outage.
4. **Before any publishing or messaging commission**, close the separately
   exposed receipt/outbox authority issue. Move sensitive receipt issuance
   and state transitions behind trusted server-only endpoints/permissions
   while preserving immutable Action Core approval fingerprints. Test raw
   PostgREST owner clients attempting to manufacture receipts or bypass
   approval. Do not prematurely revoke still-used RPCs without a coordinated
   backend code cutover.
5. Run Social Core Certification, Jhadina full release gates and exact-head
   checks, plus migration advisors and production drift proofs.
6. Obtain separate approval for applying migration, setting commissioning
   flag, deploying/promoting runtime, provider authorization and the first
   real publication canary. A green CI/READY Vercel deploy is not proof of
   live login/provider acceptance.

## Safe read-only Postgres inspection examples

```sql
select tablename, rowsecurity from pg_catalog.pg_tables
 where schemaname='public' and tablename like 'jhadina_social%' order by 1;

select p.proname,
       has_function_privilege('authenticated',p.oid,'EXECUTE') auth_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
       p.prosecdef security_definer
from pg_proc p join pg_namespace n on p.pronamespace=n.oid
where n.nspname='public' and p.proname like 'jhadina_social_%'
order by 1;

select version,name from supabase_migrations.schema_migrations
 where name ilike '%social%' or name ilike '%creator%' order by version;
```

## Source links

- Canonical Social #494: https://github.com/bookieandco/crispy-waddle/pull/494
- Merged Relay #1420: https://github.com/bookieandco/crispy-waddle/pull/1420
- Open Social Juggernaut #1136: https://github.com/bookieandco/crispy-waddle/pull/1136
- Draft Social-Free #1328: https://github.com/bookieandco/crispy-waddle/pull/1328
- Supabase advisor: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
