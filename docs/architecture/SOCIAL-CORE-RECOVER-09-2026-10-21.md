# SOCIAL-CORE.RECOVER.09 — read-only production evidence and owner-device acceptance

Date: 2026-10-21
Parent: draft #1440 `252b6670b654b3cb641d6ef978af10f25c37f3cd`.
Scope: **read-only production inspection and source-only instrumentation.**
No production migration, Edge Function deploy, Vercel promotion, account
OAuth/registration, secret access, permission change, flag flip, DM,
publication, scheduling or expenditure.

## Checked, exact current production evidence

- GitHub: `main@8e3ffebfed8ad6dd1707436173c97b6e682ed480`;
  consolidated #1440 remains draft at `252b6670`. All eleven
  non-skipped exact-head check jobs on #1440 passed, including full build,
  Social Core, UX, JLLM and both disposable PG authorization suites.
- Vercel: the existing Jhadina production deployment is READY and points to
  `main@8e3ffeb` (not #1440 or this child branch).
- Supabase: Jhadina project `kqbkaozfjubkjevdfvic` is `ACTIVE_HEALTHY`
  on Postgres 17. Its `jhadina-service-proxy` function reports ACTIVE
  version 6, `verify_jwt=false`. This last setting relies on the code's
  explicit Vercel/GitHub OIDC checks; existence does not prove a live OIDC
  authorization handshake or a successful privileged PostgREST call.
- Read-only pg_catalog check: 20 expected Social mutation RPCs exist and
  **20/20 remain executable by `authenticated` or `anon`**. The new
  `jhadina_social_server_mutation` dispatcher is **absent**. The shared
  authenticated-executable `append_jhadina_audit_event` is still exposed.
  `jhadina_social_studio_workspaces` is **absent**.
- The live audit function source MD5 remains
  `148e77452cbab6a05e6bc8479a1f3d64`, matching the `.08` staged
  drift-guarded proposal. This is source parity, NOT deployment.
- Migration ledger drift remains unresolved: applied Social reconcile
  `20260921215150` vs source file `20260921223500`, and applied
  transcript-fold `20260929015104` vs source file `20260929014500`.
  Do not edit applied ledger rows blindly.

## Implemented in this child source branch

`/api/social/acceptance` is a GET-only, private no-store endpoint:
1. Checks request-scoped Supabase SSR identity claims; signed-out = 401.
2. Verifies the configured Supabase hostname is the exact Jhadina project
   before reaching the database.
3. Uses only a normal authenticated user-scoped HEAD+exact count SELECT of
   `public.jhadina_social_accounts` with `user_id` equal to the verified
   identity; read errors fail closed as 503.
4. Returns only read-only check states and a non-sensitive account count.
   It never returns user id, tokens, platform handles, private data or SQL.
5. Flags are reported **as configuration evidence only**; if enabled,
   the response explicitly says database certification is still required.
   Provider OAuth, privileged proxy, human approval and live publishing
   are always labeled `not_tested`.

A one-tap mobile button in `/social/studio` calls the endpoint from the
current browser session. No new sign-in path is invented and no login bypass
is introduced. The button does not activate anything.

`scripts/social-recover-09-production-readonly.sql` contains repeatable
metadata-only SQL statements to re-check direct function privileges, client
write exposure, dispatcher presence, live audit source hash and migration
ledger names. It has no DDL/DML and does not query private user rows.

Security tests cover: no-auth denial before DB work; refusing mismatched
Supabase project; exact RLS owner-scoped HEAD count; zero disclosure of
owner identifiers and SQL errors; no privileged proxy or provider calls;
a true env flag never being misrepresented as SQL authority verification.

## Operator-owned acceptance still not performed

The preceding evidence does NOT establish:
- Jhadina login works in Safari on the owner's physical iPhone.
- Service-role or production Vercel OIDC path authorizes the **right**
  account and correct domain, or is safe for multi-owner use.
- Real OAuth provider profile identities, supported scopes, revocation,
  rights clearance, webhook delivery or platform receipts are verified.
- Supabase schema drift has been reconciled, or service-only role grants
  actually exist in the production database.
- The Studio persistence table or independent Action Core audit provenance
  gate exists in the deployed project.

Before any live cutover: reconcile source/DB drift on an isolated matching
Postgres 17 clone, verify two separate authenticated owners plus anonymous,
validate OIDC against deployed Edge Function v6, test a safe read-only
privileged endpoint under exact issuer/project/audience, approve atomic
migration+app deployment with rollback, and perform iPhone acceptance.

## Release decision

**NO-GO for publishing, messaging, spending or production cutover.**
Safe to review and merge only under normal code review rules, but this child
does not authorize merging or deploying any PR. Keep existing flags OFF.
