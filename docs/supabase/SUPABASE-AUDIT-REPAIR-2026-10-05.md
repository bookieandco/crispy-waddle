# SUPABASE AUDIT / REPAIR QUEUE — 2026-10-05

Status: **OPEN — PLATFORM/STORAGE P0 BLOCKER**

This document is the canonical cross-system Supabase repair lane for the current SWLC outage.
Do not turn individual downstream 5xx/503 responses into separate subsystem rewrites until this
shared failure domain is repaired.

## 1. Live state snapshot

Project:

- name: `Swlc`
- ref: `kqbkaozfjubkjevdfvic`
- region: `ca-central-1`
- plan: **Free**
- Postgres: `17.6.1.147`
- control plane may report `ACTIVE_HEALTHY` or `PAUSING`;
- actual SQL remains unavailable.

Observed direct SQL failures:

- `FATAL 57P03: the database system is not accepting connections`
- `DETAIL: Hot standby mode is disabled`
- connection timeouts while recovery is active.

Observed Postgres storage/recovery failure:

- `could not extend file "base/5/29792": No space left on device`
- repeated WAL replay;
- crash/restart loop after reaching the disk-full point.

Pause/restore behavior:

- Supabase accepted pause requests and transitioned the control plane to `PAUSING`;
- the project did not reach `PAUSED`;
- Postgres continued/restarted WAL recovery underneath the pause attempt;
- `restore_project` correctly refused to run because the project was still `PAUSING`;
- no destructive restore was forced;
- no database rows, migrations, or Storage objects were deleted to manufacture space.

## 1A. 2026-10-07 commissioning evidence

New live evidence tightened the incident boundary without changing the recovery order:

- Postgres failed recovery at `2026-10-07T04:06:44Z` with
  `could not extend file "base/5/29792": No space left on device`;
- the startup process exited and PostgreSQL restarted at `2026-10-07T04:07:07Z`, then replayed WAL again;
- the SWLC organization is confirmed **Free tier**; current platform documentation describes a
  500 MB database-size quota and 1 GB disk for Free projects;
- the former Director RunPod `xn73vwwekavcc6` is confirmed **missing / 404**, not merely stopped or
  waiting for GPU allocation;
- Director MuseTalk source/runtime contracts merged in PR #1126; the runtime is **not** claimed live;
- Director gateway version 18 is deployed with pod/human-media registration fields;
- PR #1128 bounded Director's SWLC probes and proved that One Shot / Guarded Replacement remain
  fail-closed with **no billable GPU created** while SWLC authority is unavailable;
- the latest Supabase Production Recovery Certification returned platform HTTP 500 and skipped all
  privileged cross-system certification traffic.

Operational conclusion: this remains a platform-capacity/recovery incident. Downstream Director,
Memory, SAM, Overage, Business Factory, and other 5xx responses remain non-admission evidence until
`SUPABASE-PLATFORM.1` and `SUPABASE-DB.2` are green.

## 2. P0 — SUPABASE-PLATFORM.1: disk / recovery loop

**State:** BLOCKING ALL DB-BACKED PRODUCTION WORK.

Repair target:

1. Get SWLC out of the disk-full crash/recovery loop through a platform-safe path.
2. Prefer Supabase platform intervention or additional database capacity over deleting data blind.
3. Do not run `VACUUM FULL`, large rewrites, migration pushes, or cleanup SQL while the database
   cannot accept connections.
4. Do not treat the control-plane `ACTIVE_HEALTHY` label as proof of database health.

Admission proof:

- direct SQL returns successfully;
- `pg_is_in_recovery() = false`;
- Postgres logs show ready-to-accept-connections;
- no new `No space left on device` event after recovery.

## 3. P0 — SUPABASE-DB.2: database availability

**State:** BLOCKED by PLATFORM.1.

After storage recovery, capture:

- `select now(), current_database(), pg_is_in_recovery();`
- database size;
- WAL directory size;
- largest relations;
- index/table bloat;
- active replication slots/subscriptions;
- long-running/abandoned transactions.

Do not delete anything during discovery. Produce evidence first.

## 4. P0 — SUPABASE-MIGRATIONS.3: migration integrity / drift

**State:** UNKNOWN because `list_migrations` currently fails with Postgres `57P03`.

Once SQL is healthy:

1. capture remote migration history;
2. compare remote applied versions with repo migration files;
3. identify missing, duplicate, reordered, or partially applied Director/SAM/Overage/Memory migrations;
4. verify RLS, grants, service-role access, triggers, functions, indexes, and rollback safety;
5. apply only surgical migrations required by verified drift.

**Do not use blind `supabase db push` as the recovery mechanism.**

## 5. P1 — SUPABASE-AUTH/API.4: Auth + PostgREST recovery

Observed symptoms during the outage:

- GoTrue/Auth startup migration attempts fail with SQLSTATE `57P03`;
- PostgREST emits `PGRST000` and cannot load schema cache;
- REST calls return 503 while Postgres is unavailable.

After DB recovery verify:

- Auth boots without migration failure;
- user/session operations work;
- PostgREST schema cache loads;
- REST HEAD/read/write probes succeed under intended RLS;
- no auth tables were rolled back unexpectedly.

These are currently considered **downstream outage symptoms**, not separate application-code defects.

## 6. P1 — SUPABASE-EDGE.5: Edge Function dependency audit

Edge Functions can remain control-plane `ACTIVE` while their database operations fail.

Known active surfaces include:

- `jhadina-memory-gateway`
- `jhadina-service-proxy`
- `jhadina-spatial-gateway`
- `jhadina-director-live-cert-gateway`
- `jhadina-director-bonez-gateway` — deployed **version 18**
- `jhadina-sam-gateway`
- `jhadina-sam-secret-health-probe`
- `jhadina-sam-runtime-gateway`
- `ovr-operator-gateway`
- `jhadina-audit-ingest`
- `oce-sam-discovery`
- `oce-grants-discovery`
- `wallet-verify`
- other project Edge Functions listed by the control plane.

Observed outage evidence includes:

- `jhadina-memory-gateway` POST 500;
- REST 503 against database-backed resources.

Post-recovery audit each database-dependent function for:

- 2xx health/action response;
- correct database/RLS behavior;
- correct secrets/identity binding;
- no stale runtime identifiers;
- no silent fallback to mocks.

Do not redeploy every function merely because the shared database was unavailable.

## 7. P1 — SUPABASE-OIDC.6: Vercel/GitHub identity paths

Current Director gateway source/deployment has the intended narrow policy:

- Vercel production OIDC for privileged Director server routes;
- GitHub one-shot/replacement OIDC for RunPod provisioning status;
- runtime registration restricted to the guarded replacement workflow / one-shot call chain;
- scheduled one-shot may perform status preflight only.

After database recovery re-prove:

1. Vercel production OIDC → service proxy / Director gateway;
2. GitHub scheduled one-shot → provisioning-status;
3. guarded replacement → registration;
4. unauthorized workflow/token → 401/403;
5. no long-lived secret becomes required merely because the database recovered.

## 8. P1 — SUPABASE-RUNTIME-CONFIG.7: runtime config + stale bindings

After SQL is healthy audit `director_runtime_config` and related configuration tables for:

- stale canonical RunPod pod id `xn73vwwekavcc6` (confirmed missing / 404 in live RunPod inspection);
- Hunyuan worker URL/token bindings;
- speaker-QC runtime binding;
- Bonez voice runtime binding;
- stale temporary bootstrap chunks/tokens;
- Watch callback/runtime settings;
- values that point at retired workers or proxies.

Do not write a new RunPod runtime registration until SWLC is durable and the replacement
workflow has authority to persist the new canonical runtime.

## 9. P1 — SUPABASE-STORAGE.8: Storage metadata/object integrity

Supabase database backups and Storage objects are different failure domains. After recovery:

- verify required buckets exist;
- verify database metadata rows still match object paths;
- verify current canonical Director reference/audio/video objects;
- verify no orphaned metadata points to missing objects;
- verify no object was assumed restored solely because database metadata was restored.

Relevant Director buckets include at least:

- `director-media`
- `director-character-references`

Do not delete orphan candidates until provenance is checked.

## 10. P1 — SUPABASE-CROSS-SYSTEM.9: shared dependency certification

Once DB/API/Auth are healthy, run bounded health probes for every Jhadina subsystem that uses SWLC.

At minimum:

- Memory;
- Director;
- Workstation / Business Factory;
- SAM / Opportunity;
- Overage;
- Spatial;
- Action audit ledger;
- OCE discovery;
- wallet verification if still part of the active runtime.

Each subsystem should distinguish:

- **database unavailable**
from
- **its own application defect**.

## 11. P2 — SUPABASE-CAPACITY.10: production hosting decision

Current SWLC is Free-tier and has demonstrated a disk-capacity failure severe enough to prevent
crash recovery.

Before calling the environment production-stable, choose one durable direction:

### Option A — keep Supabase as production authority

- move SWLC to a tier/capacity model with managed disk headroom;
- retain the existing Supabase auth/RLS/Edge architecture;
- add disk/WAL utilization alerting and a capacity admission threshold.

### Option B — migrate canonical durable authority toward Homebase

- keep Supabase as optional/cloud integration where useful;
- move critical durable state to the canonical Homebase database/runtime;
- migrate subsystem-by-subsystem with receipts and rollback;
- do not attempt this migration as an emergency substitute while SWLC data cannot be read.

This is an architecture/cost decision, separate from the immediate recovery incident.

## 12. Immediate recovery order

`SUPABASE-PLATFORM.1 → SUPABASE-DB.2 → SUPABASE-MIGRATIONS.3 → SUPABASE-AUTH/API.4 → SUPABASE-EDGE.5 → SUPABASE-OIDC.6 → SUPABASE-RUNTIME-CONFIG.7 → SUPABASE-STORAGE.8 → SUPABASE-CROSS-SYSTEM.9 → SUPABASE-CAPACITY.10`

Only after **SUPABASE-CROSS-SYSTEM.9** is green should Director resume:

`trusted Homebase post compute → post-worker receipts → Watch commissioning → real Business Factory canary → DIRECTOR-AUTO.FINAL`

## 13. Current no-go list

Until direct SQL is healthy:

- no blind migration push;
- no schema cleanup;
- no database row deletion to free disk;
- no `VACUUM FULL`;
- no fake Watch/Business Factory receipts;
- no RunPod replacement registration without durable SWLC authority;
- no declaration of `DIRECTOR-AUTO.FINAL`;
- no rewriting downstream subsystems solely because their DB dependency is returning 5xx.
