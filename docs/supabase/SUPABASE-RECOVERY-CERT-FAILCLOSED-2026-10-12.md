# SUPABASE-DB.2 → CROSS-SYSTEM.9 — truthful read-only probe gate

**Date:** October 12, 2026. **Status:** staged, not deployed. SWLC `kqbkaozfjubkjevdfvic` remains unverified for writable database, WAL/disk headroom, real owner session and independently recoverable backups.

## Defect

The existing protected `/api/internal/supabase/recovery-cert` route checked the reachability of tables, Auth-admin, storage listing and director config, then set `ready=probes.every(p => p.ready)`. All could succeed against **read-only** PostgREST and `service_role` while hiding:

- PostgreSQL `transaction_read_only=on`, disk full, stale/absent migration and WAL headroom.
- No authenticated owner session, RLS allow/deny test, cross-session memory read/write evidence.
- No verified encrypted independent restore or object-byte hashes; `storage.list` is a metadata lookup.
- Missing Director worker configuration: old code treated zero configured keys as `ready=true`.
- Empty reference sample: old code returned `verified 0 sampled ...` and marked readiness true.
- No independent job execution or safety watchdog notification delivery receipts.

The scheduled GitHub workflow treated a 200 + `ready=true` response as `SUPABASE_CROSS_SYSTEM_RECOVERY_READY`. This was a potential **false-positive production certificate**.

## Scope of safe repair

- Read-only route **never emits** `ready=true`, `ok=true`, or a cross-system-ready state. It returns `503` and either `BLOCKED` (failed probe) or `REVIEW_REQUIRED` (all read-only probes respond), with `certification=NOT_ISSUED` and explicit missing evidence.
- Table, auth-admin and storage-list probes continue to return truthful connectivity evidence without elevating their meaning to owner/RLS/write verification.
- If no Director runtime bindings or no sampled reference asset objects exist, their respective probes report non-ready. If object names are found, the report explicitly says physical bytes and hashes remain **unverified**.
- The recovery workflow treats any `ready=true` emitted by this read-only endpoint as an unsafe contract violation; never prints a cross-system green certification.
- The TypeScript admission module and Vitest tests assert green-but-read-only, failed, empty, malformed and spoofed input can **never** grant execution or certification. The legacy Python source contract also requires the guard.

## What this cannot fix

It does **not** increase Supabase capacity, grant owner authorization, modify SQL, prove backup restoration, enable cron or clear `#1110`. It does **not** assert no additional applications depend on SWLC. After capacity is restored, a **separate**, narrowly authorized, reviewed operator verification and evidence-receipt protocol must prove:

1. Read/write DB and WAL/disk headroom, no new `53100`.
2. Version/name/DDL fingerprint reconciliation, reviewed migrations and privileged grants.
3. Actual owner Auth sign-in and negative RLS checks, durable multi-session memory.
4. Physical object checksum downloads and independently restored encrypted backup.
5. Safe workstation/Director/SAM/Overage and other system canaries, actual worker executions.
6. Exact deployed commit SHA, change control and independently reviewed signoff.

No `db push`, plan charge, data deletion, or safety notification is authorized by this PR.

Related: [capacity P0 #1110](https://github.com/bookieandco/crispy-waddle/issues/1110), [read-only recovery audit #1225](https://github.com/bookieandco/crispy-waddle/pull/1225), [safety watchdog #1226](https://github.com/bookieandco/crispy-waddle/pull/1226), [migration drift guard #1227](https://github.com/bookieandco/crispy-waddle/pull/1227).
