# JH-SWLC-RECOVER.AUTH.01–.04 — source-only recovery handoff (2026-10-20)

## Canonical backend evidence

- Existing SWLC Supabase project `kqbkaozfjubkjevdfvic`; organization `vbodmeyvsdeivoxvcnve` is confirmed Pro.
- Direct read-only SQL: `pg_is_in_recovery() = false`, `transaction_read_only = off`, `default_transaction_read_only = off`. Database size 1,316 MB (NOT total disk occupancy).
- A single transaction created a temporary Postgres table, inserted one test row, selected its count (1), and issued `ROLLBACK` with no persistent write. This proves privileged SQL accepts transactional writes **but not** application session authorization, RLS, Storage policy or real session persistence.
- 365 recorded live migrations, 391 RLS-enabled public tables; Auth: 1 existing confirmed account, password configured, no recorded successful sign-ins, and 0 sessions when observed. No password was read or changed.
- Storage has 7 buckets, 13 objects. Schema read works. Supabase dashboard disk headroom/WAL/backup freshness still require operator evidence.
- Security advisors: 159 RLS-no-policy informational findings (some tables may be intentionally service-only), 35 authenticated SECURITY DEFINER executable warnings, 2 mutable function search path warnings, and leaked password protection warning. These remain REVIEW ONLY; do not blanket-add RLS policies or auto-fix.
- Largest observed table allocations: SAM catalog 509 MB and SAM versions 399 MB. Do not delete, VACUUM FULL, or shrink without owner approval and backup proof.

## Auth source reconciliation

Source donor: draft PR #1418 @ `c0ae4700`. Base: current main `0ee6db8`, not historical donor main. Selectively port **only** login/action, typed outage handling, signup, explicit recover/reset pages/actions, strict email callback for token or PKCE, and relevant tests.

Changes:
1. Existing-account, password-first phone login with optional passkeys and a **visible reset link**. No second account necessary.
2. `/auth/recover` owner-initiated request only; neutral response avoids user enumeration; no emails sent by this PR.
3. `/auth/confirm` token_hash / PKCE code handling, safe internal redirect, failure closed on provider error.
4. `/auth/set-password` requires a verified, non-anonymous Supabase user session, validates matching passwords, and calls Auth updateUser only after user action.
5. `/auth/signup` separated from existing-account login and validates confirmation.
6. Restore tests: password validation, safe callback origin (reject localhost on Vercel), same-origin redirect, provider failure, error hygiene.
7. **Do not port** PR #1418 Facebook personality, ContextBuilder, owner-memory approval, preview-only middleware exception, or unrelated Supabase SQL/migrations.

## Required gates before production use

- Exact-HEAD CI: web type-check, Vitest for `src/lib/auth/login-outage.test.ts`, `src/lib/auth/password-recovery.test.ts`, `src/app/auth/confirm/route.test.ts`, existing middleware/passkey tests, and full web build. Check all GitHub Actions at exact SHA.
- Compare with latest `main` before any merge; preserve all current changes.
- Confirm Vercel project environment variables contain correct publishable Supabase URL/key and canonical HTTPS app origin (without revealing credentials).
- Confirm Supabase Auth Site URL and approved Redirect URL allowlist include the **exact** selected private deployment URL. Do not add wildcard trust or disable Vercel SSO.
- Physical iPhone/Safari test: owner signs in with existing confirmed email and known password, or explicitly requests reset email; confirm link -> choose password -> sign in -> private home -> close/reopen -> confirm owner-only durable session.
- Separate two-user RLS and authenticated transactional persistence checks only after reviewing account isolation and existing policies.
- Review database **disk** (WAL/system/allocated capacity) separately from pg_database_size; verify backup restore point before large writes/migrations.
- No real email sent, password reset attempted, new Auth user created, migration applied, provider invoked, production merged or public preview exposed by this code-only sequence.

**Status:** SOURCE-READY FOR REVIEW; DB write access proven; live Auth session, backup/disks and iPhone acceptance still unverified.
