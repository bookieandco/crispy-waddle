# SOCIAL-ID.26 — isolated database and atomic transaction rehearsal (NOT APPLIED)

**2026-10-12, America/Los_Angeles.** Source parent PR #1236, SHA `5be0ef9097f9dee7973ce21ffb77fb77b30ad576`.

## Deliverables
- `ops/sql/SOCIAL-ID-26-ISOLATED-REHEARSAL-NOT-APPLIED.sql`: self-contained **non-exposed**, isolated schema `social_id26_rehearsal`, simulated identities/canonical packets/approval receipts/parent batches/child outbox, and two SECURITY INVOKER PL/pgSQL atomic staging functions.
- `ops/sql/SOCIAL-ID-26-ISOLATED-DRILL-ROLLBACK.sql`: owner and foreign-owner fixtures, pending vs approved receipts, exact idempotent retry, identity-version drift, forged publication/dispatch authority and duplicate prevention. Begins a transaction and ROLLBACKs fixture changes. All receipt data here are simulated.
- `apps/jhadina-web/src/lib/social/social-id-26-sql-rehearsal.test.ts`: CI structural/static tests for isolation, fail-closed constructs, revocation, and rollback coverage. Static CI is **not** proof the SQL ran in Postgres.

## How to run on an isolated disposable PostgreSQL 15+ database
Only on a **separately created disposable Postgres database** (NEVER SWLC, never the live Supabase project's SQL editor). Confirm the connection target with `select current_database(), inet_server_addr(), current_user;` and verify it is not a live instance. The scripts create an isolated schema, not a production migration.

```bash
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f ops/sql/SOCIAL-ID-26-ISOLATED-REHEARSAL-NOT-APPLIED.sql
psql "$DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f ops/sql/SOCIAL-ID-26-ISOLATED-DRILL-ROLLBACK.sql
```

Record Postgres version, exact server target (redact credentials), SQL SHA-256 hashes, PASS/FAIL notice, rows before/after, and a distinct transaction/session to verify readback. **No actual Postgres execution has been performed by this milestone** because no isolated server is available in this runtime.

### Two-session concurrency drill (manual; not certified here)
On an isolated clone with identical parent state, Session A begins and locks canonical `packets` via `SELECT ... FOR UPDATE`. While A holds that lock, Session B invokes `stage_parent` with the *same* receipt and fingerprint. B must wait; when A commits, B returns the same persisted batch. With different receipt/changed packet/identity it must error without consuming a second receipt. Repeat for `stage_child` and a simulated lost response. Observe transaction locks and row counts. Do **not** treat static tests as a concurrency test.

## Critical non-production limits
1. Receipt rows and canonical packet/identity admission are **simulated**. SQL compares owner-scoped saved fingerprints; it does **not** compute/independently prove the JavaScript .19 composite fingerprint or cryptographically authenticate provider results.
2. These functions have **no client execute grants**, no Data API endpoint, no production route, and cannot dispatch, publish, comment, send messages, purchase ads, invoke Director, or retry.
3. There is **no guarantee the stage SQL matches the existing live schema**. It is a standalone rehearsal to inform a later reviewed migration after full inventory, RLS, backups, restore and two-account readback. Do not rename this to a migration or automatically apply it.
4. Deleting the schema requires a separately reviewed `DROP SCHEMA social_id26_rehearsal CASCADE` on the disposable DB **only**; this command is not included in executable SQL.
5. No actual dispatch-side Action/Security permit is issued; a persisted child outbox record remains `AWAITING_DISPATCH_CERTIFICATION`.

## Audit/repair
- [SOCIAL-ID.16 database/RLS and isolated backup restore #1211](https://github.com/bookieandco/crispy-waddle/issues/1211) is still open.
- [SOCIAL-ID.22 atomic outbox, owner approval and dispatch #1222](https://github.com/bookieandco/crispy-waddle/issues/1222) remains open.
- PR stack source certification is separate from isolated PG transaction certification and production certification.

## Next stage
Reconcile proposed rehearsal with the real SWLC migration inventory; create a migration via the Supabase CLI **only after** independent restore/proven isolation, test actual SQL and concurrent sessions, then add authenticated canonical admissions, true RLS/readback, and per-action real permit. No auto-commissioning based on a green test suite.
