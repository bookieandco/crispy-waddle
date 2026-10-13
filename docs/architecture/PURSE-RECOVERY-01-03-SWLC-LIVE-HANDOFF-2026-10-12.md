# PURSE-RECOVERY.01–.03 — SWLC storage, Memory, and backup admission
Date: 2026-10-12 America/Los_Angeles (live probes through 2026-10-13 02:45 UTC)
Status: **P0 BLOCKED — source-only handoff; no financial authority**

## Scope and invariant
Jhadina's **Purse** is the owner-governed REAL-money treasury using legacy Coffer storage.
SHADOW is the non-executing paper research/learning lane. SHARK generates intelligence.
No DB/admin action, paid infrastructure, bank/Phantom transfer, wallet signing, live
trade, payout, autonomous mandate or owner financial approval was performed here.

This report updates the earlier 2026-10-09 Purse handoffs. It must not be used as a
certification receipt or as permission to run production SQL, change billing, or bypass
`/api/health`.

## .01 — SWLC capacity: direct SQL readable, writes blocked
- SWLC project `kqbkaozfjubkjevdfvic`, organization `vbodmeyvsdeivoxvcnve`:
  live organization lookup returned `plan=free`; project metadata `ACTIVE_HEALTHY`.
- Direct SQL at 2026-10-13 02:44:55 UTC returned
  `pg_is_in_recovery() = false`,
  `default_transaction_read_only = on`,
  `transaction_read_only = on`, and
  `pg_database_size(current_database()) = 1248152723` bytes.
- PostgreSQL logs at 02:44:46 UTC still recorded
  `No space left on device` for `base/pgsql_tmp/...`,
  followed by repeated read-only UPDATE/DELETE failures.
- Supabase's Free database quota is 500 MB; the DB footprint is about 1.25 GB.
  Database-size metrics do not equal total disk use (WAL and system files add space).
  Thus reachable management SELECTs cannot establish sufficient disk/WAL headroom,
  successful writes, or production-safe migrations.
- Do **not** set `default_transaction_read_only=off` to bypass a quota,
  perform bulk DELETE, VACUUM FULL, drop indexes/data, truncate WAL, pause/restore,
  `supabase db push`, or create a billable resource in this sequence.

**Exit gate:** owner/provider-approved capacity remediation preserving original bytes;
verified sufficient disk and WAL headroom; no new 53100/full-disk errors; independently
authorized nonfinancial write/read/restart test; Auth + PostgREST service-role and
intended user-RLS allow/deny tests. Supabase support or an owner-authorized upgrade
may be necessary; neither was requested or performed by this audit.

## .02 — Memory/API: shared infrastructure failure, not a Purse fix
- The current Vercel `/api/health` returned 500, reporting
  `JHADINA_MEMORY_GATEWAY_FAILED:probe:500:storage_operation_failed`.
- Source `VercelOidcMemoryStorage.ts` calls the protected
  `jhadina-memory-gateway` Edge Function using Vercel OIDC.
- The active deployed Edge Function's `probe` runs a service-role
  HEAD/count on `public.jhadina_memories`. Direct SQL proves that table
  exists, but production `postgrest_logs` recorded `HEAD /jhadina_memories`
  HTTP **503**; the Edge function then produced HTTP 500.
- This is downstream of the currently broken storage/Data API path.
  Do **not** weaken OIDC, switch durable Memory to in-memory fallback,
  redeploy unrelated functions, or relabel `ACTIVE`/Vercel `READY` as usable.

**Exit gate:** PostgREST no longer responds 503; protected OIDC Memory probe
returns 200; `/api/health` returns 200; authenticated Memory can read after
a real worker/database restart, with independent readback receipt.

## .03 — Backup: distinguish hosted SWLC from LOCAL_HOMEBASE_COMPOSE
- The private Drive destination `JHADINA-HOMEBASE/01-BACKUPS/SWLC-POSTGRES-ENCRYPTED`
  (folder ID `1kNddFFBmVQ21-1MpNzxSIC-QoR48cjW_`) was **empty** when checked.
  Directory existence and synthetic canaries are not database-backup receipts.
- `infrastructure/homebase/google-drive/backup.py` only accepts
  `JHADINA_POSTGRES_BACKUP_SOURCE=LOCAL_HOMEBASE_COMPOSE`, and its receipts
  explicitly say `hosted_supabase_data_covered=false`.
  `restore_drill.py` verifies only that local-source custom dump in an
  isolated PostgreSQL 17 container. It **cannot** certify original hosted SWLC.
- Historic SHADOW Google Drive `01-LEDGER-SNAPSHOTS` is also empty; the
  original RunPod/Shadow ledger remains **UNRECOVERED**.
- Before migration, destructive maintenance or source decommission, take an
  **actual hosted SWLC backup** using an authorized owner-controlled trusted
  environment or Supabase-supported export, encrypt before offsite transfer,
  record original source identity, exact hash, immutable snapshot ID,
  independent download/hash proof and isolated Postgres restore with schema +
  meaningful row/ledger parity checks. Keep source untouched until parity proven.
  Never copy a service-role secret, wallet key, dump, or private receipt into Git.

**Exit gate:** independently verified encrypted SWLC original-data offsite
backup + isolated restore + economic/relationship parity; separate original
SHADOW provenance or explicit `UNRECOVERED`. Local Homebase-only or
synthetic receipts must fail SWLC admission.

## Purse source/release dependencies — no substitute for .01-.03
- Purse release chain remains open, unmerged:
  `#1162 -> #1166 -> #1186 -> #1188 -> #1190 -> #1191 -> #1192`.
  Review, reconcile against current `main`, pass exact-head CI, and acquire
  independent approvals. Do not deploy an older stacked branch over current main.
- PR `#868` for SHARK/sports/personality/learning remains separate and unmerged;
  no paper lesson may create live capital authority.
- DB rows checked for Coffer/Purse charters, allocation/decision sets,
  rebalance plans, wallet connections, real mandates, payout policies and
  financial approvals were all **zero**. Placeholder stock, FX and DEX
  market connectors were all `UNCOMMISSIONED`; the funding rail is also
  `UNCOMMISSIONED` with no certificate.
- `#1227` addresses migration collisions/drift offline; `#1228` addresses
  false read-only production certification. Reuse them rather than duplicating
  recovery engines. Neither source PR changes live disk capacity.

## Explicit release state
```json
{
  "storageReadOnly": true,
  "storageWritableCertified": false,
  "memoryGatewayReady": false,
  "hostedSupabaseBackupVerified": false,
  "originalShadowHistoryRecovered": false,
  "purseLiveFunded": false,
  "purseLiveCommissioned": false,
  "canExecute": false,
  "canMoveMoney": false,
  "canAuthorizeLive": false,
  "financialAuthority": "NONE",
  "status": "BLOCKED_OWNER_OR_PLATFORM_CAPACITY"
}
```
The JSON above is a *dated audit classification*, not a live-updating machine
receipt; every fact must be freshly independently rechecked before admission.

## Primary sources
- Incident: https://github.com/bookieandco/crispy-waddle/issues/1110
- Existing source release preflight: https://github.com/bookieandco/crispy-waddle/pull/1192
- SWLC re-audit: https://github.com/bookieandco/crispy-waddle/pull/1225
- Migration guard: https://github.com/bookieandco/crispy-waddle/pull/1227
- False-certification repair: https://github.com/bookieandco/crispy-waddle/pull/1228
- Supabase database/disk limit: https://supabase.com/docs/guides/platform/database-size
