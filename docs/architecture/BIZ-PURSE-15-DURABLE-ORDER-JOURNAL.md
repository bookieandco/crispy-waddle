# BIZ-PURSE.15 — Durable Customer Order Journal: Atomic Persistence Boundary

Status: **CODE IMPLEMENTED / DISPOSABLE TEST CONTRACT ONLY; NOT COMMISSIONED**. October 14, 2026 PDT.

PR: https://github.com/bookieandco/crispy-waddle/pull/1275
Supabase repair: https://github.com/bookieandco/crispy-waddle/issues/1276

## Scope

`packages/opportunity-core/src/domain/biz-purse-durable-order-boundary.ts` provides a typed, narrowly gated port, append request, strict JSONB decoding and readback-only projection. The port **only** admits `mode='DISPOSABLE_POSTGRES_TEST_ONLY'`. It cannot connect to a production Supabase database and cannot charge, deliver, pay owners, spend, trade, settle or recognize spendable profit.

`supabase/recovery/biz-purse-15-order-journal.local.sql` is a **local-only** atomic append schema, intentionally **NOT** in `supabase/migrations/`. It is protected by a database-name guard `biz_purse_recovery_*`, uses a private non-exposed schema, restricts all browser/anon/authenticated grants and never grants an external financial action. The RPC is `SECURITY INVOKER`, limits execution to postgres/service_role, locks each `owner_user_id,order_id` stream `FOR UPDATE`, appends a single event and advances its stream head together in one DB transaction. Concurrent writers with the same predecessor cannot both append.

Uniqueness requirements in the staged SQL:
- `(owner_user_id,order_id,sequence)` is the journal primary key.
- `(owner_user_id,event_id)` prevents reuse of an event ID across orders.
- `(owner_user_id,provider,provider_event_ref)` prevents webhook/provider-event reuse.
- For `PAYMENT_SETTLED`, `(owner_user_id,provider,provider_payment_id)` prevents the same settled payment being bound to another order.
- Exact same event ID and byte-canonicalized JSONB payload can be replayed; conflicting replays, stale sequence/head, different owner/order or reused provider payment fail closed.

Provider identifiers and independent provider readbacks are still required before any genuine customer payment can be admitted. A boolean like `providerReadbackVerified=true` **inside an untrusted event** is not independent provider verification and never grants authority.

## Test and verification sequence

1. `pnpm --filter @jhadina/opportunity-core test` runs `biz-purse-durable-order-boundary.test.ts` and `biz-purse-durable-order-sql.test.ts`. Synthetic race and readback tests cover exact replay, collisions, stale heads, broken payments, malformed money serialization and uncertain provider responses. SQL structure tests are **static**, not evidence of actual concurrency in PostgreSQL.
2. **DB-01/02/03** from issue #1276 must pass first: verified independently restorable backup, historic version collision remediation, full reviewed migration replay on disposable PostgreSQL and owner-isolation/RLS tests. Current live SWLC data is not ready.
3. After 1–2, run the staged .15 SQL solely on an already commissioned **disposable** local Supabase/Postgres instance; capture schema SHA, exact Git head, SQL readback, authentication isolation, RPC grants and real two-session race tests. No local run of this SQL has been completed in this coding turn.
4. Review the service-only schema, RLS/bypass boundary and guaranteed source of ownerUserId. The local SQL trusts its server-side caller; it must never accept arbitrary owner IDs from public request bodies or browser Supabase clients.
5. Separately implement an approved server-only Postgres adapter with a verified owner-session context, provider idempotency provenance and durable readback. Add authenticated two-tenant transaction and outage/restart tests. Never permit `UNKNOWN` payment states to auto-retry charges.
6. Only after independent sign-off should a **new, collision-free** production migration be proposed; do not transplant staged disposable SQL into a live migration or hand-mark schema_migrations as applied.

## Nonclaims

- No production database schema modifications, inserts, provider charges, orders, payments, owner payouts, market orders, real host deployment or actual Postgres concurrency proof.
- No payment receipt is promoted into cash or owner distributable profits.
- A green source/CI test is **not** a commissioned payment or Supabase certification.

Next code-only target: BIZ-PURSE.16 Stripe/provider sandbox adapter with signed raw-body webhook verification and independently fetched payment state, still disabled until payment-provider credentials and sandbox canaries are owner-authorized.
