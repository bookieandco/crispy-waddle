# BIZ-PURSE.14 — Supabase Recovery Harness

## Recovery status — October 14, 2026 PDT

**Code-only audit implemented; database recovery NOT completed.**

- [Draft PR #1275](https://github.com/bookieandco/crispy-waddle/pull/1275)
- [Supabase audit/repair issue #1276](https://github.com/bookieandco/crispy-waddle/issues/1276)
- SWLC project `kqbkaozfjubkjevdfvic`: production was examined through **read-only SQL**; all five required commercial tables and all six canonical commercial RPC signatures were still absent at 2026-10-15 02:36:57 UTC.
- The remote migration history recorded **365** versions when inspected; the GitHub repository inventory contained **223** timestamped SQL migration files (main branch snapshot). These counts do not prove the histories are interchangeable. The remote's latest recorded entries included two October 15 SHARK research migrations while multiple canonical October 2–3 Side Hustle versions were missing.
- The repository contains **eight duplicate 14-digit migration versions**. Supabase version collisions must be reconciled against applied history and dependencies before applying anything. One collision directly affects `20261003221000_side_hustle_digital_product_studio_registry.sql`, sharing `20261003221000` with `director_durable_workstation_timeline.sql`.
- Canonical `jhadina_side_hustle_commerce_record_save` takes `(text,jsonb)`. The older status probe incorrectly checked `(jsonb)`; corrected in this branch.
- Four migrations of immediate business interest: `20261002190000`, `20261003143000`, `20261003181500`, `20261003221000`.
- The canonical migrations expose a mixture of authenticated-select RLS and authenticated-callable `SECURITY DEFINER` RPCs. Explicit tenant-scoped authentication, default PUBLIC EXECUTE privileges, search_path and cross-owner access must be tested on disposable PostgreSQL.

## New tools: safe-by-construction

1. `scripts/biz-purse-14-migration-audit.mjs` — read-only SHA-256 inventory of the **actual SQL bytes**, duplicate version and remote/local historical drift detection; no database connection or SQL execution. Usage:
   ```bash
   node scripts/biz-purse-14-migration-audit.mjs supabase/migrations /path/to/read-only-supabase-migrations.json
   ```
   The ledger JSON is an object with `observedAt` and `migrations: [{version,name}]`. Capture the ledger using an authenticated read-only query or Supabase's `list_migrations`; do not fabricate an applied-history entry. The tool exits nonzero if it detects blockers.

2. `scripts/biz-purse-14-backup-review.mjs` — independently SHA-256 hashes a **local** backup artifact, compares the recorded byte length and reviews an operator-plus-independent-witness isolated-restore manifest. It always emits `verifiedRestoration:false` because a manifest cannot certify the database by itself:
   ```bash
   node scripts/biz-purse-14-backup-review.mjs /path/to/backup-receipt.json /path/to/local-backup.dump
   ```
   No backup or independently restored database artifact has been furnished yet; don't run this with synthetic bytes and call it production proof.

3. `scripts/biz-purse-14-security-probe.sql` — read-only relational RLS/GRANT and exact RPC signature/EXECUTE audit. Captures whether `anon` or `authenticated` can reach each object; it is NOT a substitute for two-user tests.

4. `supabase/tests/biz-purse-14-two-owner-local-only.sql` and `scripts/biz-purse-14-local-owner-test.mjs` — after a local disposable database has the **entire canonical schema**, transactional synthetic fixtures create two owner records, two opportunities and two work orders, impersonate each authenticated owner and assert zero cross-owner row visibility, verified `auth.uid()`, and no direct client inserts/updates. `ROLLBACK` discards fixtures. The script cannot use a remote DB URL or a database not named `biz_purse_recovery_*`.
   ```bash
   # ONLY after independent backup and full local migration replay; no live Supabase URL.
   export BIZ_PURSE_DISPOSABLE_DATABASE_URL='postgresql://postgres:local-only@127.0.0.1:54322/biz_purse_recovery_case'
   export BIZ_PURSE_LOCAL_CONFIRMATION=YES_DISPOSABLE_DB_ONLY
   node scripts/biz-purse-14-local-owner-test.mjs --execute-local-test
   ```
   Requires locally installed `psql`, a reachable disposable PostgreSQL instance with Supabase's `auth` schema and the canonical tables; the test runner *does not create or migrate the database*.

5. Unit tests: `node --test scripts/biz-purse-14-*.test.mjs`. They exercise collision, source-byte, history, backup, loopback-host, malicious URL and scope controls. They **do not** prove real database restoration or owner isolation; those require a commissioned disposable PostgreSQL runtime.

## Critical sequence / fail-closed release boundary

- **DB-01** Record a genuine independently restorable SWLC backup with a byte hash, complete scope and independently witnessed isolated restore; verify readback before migration. No backup evidence means stop.
- **DB-02** Review the **whole** historical migration chain, the eight duplicate versions and 365-vs-223 recorded/source asymmetry. Repair historical conflicts in a separate audited change without modifying, inventing or spoofing production migration history. Obtain reviewer approval of the exact ordered list and all SQL SHA-256s.
- **DB-03** Replay approved canonical migrations in a truly disposable, already bootstrapped Supabase/PostgreSQL environment. Capture exact SQL, DDL failures, performance, API and privilege checks. Run both the read-only security probe and real two-owner SQL test. A successful local rehearsal is **not** permission to alter SWLC.
- **Production admission** independently review backup, restore, migrations, authenticated cross-tenant negatives, service-role boundaries, SECURITY DEFINER safety, runtime API readback, cost, and rollback. Explicitly commission any production schema change separately.

## Explicit nonclaims

No live production schema changed; no staging PostgreSQL/Docker or `psql` execution is claimed; no backup was provided or verified; no real owner RLS test was run. The automated tests only certify static/offline recovery logic. No payments, customer order, provider funds movement, trades, or host deployment have been commissioned.
