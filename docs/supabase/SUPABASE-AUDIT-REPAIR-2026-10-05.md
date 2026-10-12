# SUPABASE AUDIT / REPAIR QUEUE — 2026-10-05

Status: **OPEN — PLATFORM/STORAGE P0 BLOCKER**


## October 12, 2026 — LIVE RE-AUDIT / CURRENT STATE (supersedes the Oct 5 snapshot)

**Classification:** `ACTIVE_HEALTHY` control-plane metadata, **partial SQL recovery**, **READ-ONLY + DISK FULL**, **production not certified**. Do not interpret the October 5 statements below as today's SQL reachability: direct SQL has since resumed, but safe writes have not.

### Verified at approximately 17:13–17:47 UTC (read-only only)

- Organization `vbodmeyvsdeivoxvcnve`: **Free**. Existing SWLC `kqbkaozfjubkjevdfvic`: Postgres 17.6, `pg_is_in_recovery()=false`, direct SQL succeeds, **380 public tables / 363 applied migration records / 19 ACTIVE Edge Functions**.
- **`default_transaction_read_only=on` and `transaction_read_only=on`** in SWLC. Database footprint **1,248,152,723 bytes (~1,190 MiB)**. Supabase's current Free plan documentation describes **500 MB per-project database quota / 1 GB disk**; actual platform free-space and WAL headroom are still unverified.
- **Current production failure persists:** SWLC PostgREST log at 17:21 UTC contains `53100: No space left on device` while loading schema cache. Production Vercel deployment of exact `main` SHA `a6dfcdf6bde714cd17a23c0aff77dabdf42cf4ea` was `READY`, but repeated `GET /api/health` logs show `JHADINA_MEMORY_GATEWAY_FAILED:probe:500:storage_operation_failed`. Supabase Edge function logs independently confirm POST 500 at `jhadina-memory-gateway`.
- Largest table allocations include `jhadina_sam_catalog` **438 MB**, `jhadina_sam_versions` **357 MB**, `jhadina_public_jurisdictions` **101 MB**, `jhadina_public_source_discovery_jobs` **64 MB**, `jhadina_public_adapter_trials` **57 MB**, `jhadina_public_procurement_sources` **44 MB**. **Exact row counts**: catalog **69,954**, versions **126,977**, public opportunity inbox **4,991**. This is real historical data; archive and independently restore before any managed capacity reduction.
- `pg_replication_slots` returned no rows with a non-null restart LSN. This is **not** WAL-directory capacity proof.
- `pg_cron`: daily audit last recorded 2026-10-03 06:00 UTC, and safety watchdog had **18,153 recorded failed runs / 0 recorded successful** with `incident_id` SQL ambiguity, last run 2026-10-03 11:42 UTC. Job table still says active, but read-only mode makes liveness reports unreliable. Independent code defect: [#1224](https://github.com/bookieandco/crispy-waddle/issues/1224). Verified service-only function privilege (anon/authenticated denied; service_role allowed). It requires a **new reviewed** forward migration *after* platform read-write recovery, not a rewrite of the applied historic migration.
- RLS is enabled on all 380 SWLC public tables. Advisors flag **35 authenticated-callable SECURITY DEFINER functions**, **2 mutable function search_paths**, **148 tables with RLS and no policies** (often intentionally service-only), **124 unindexed foreign keys**, **37 RLS initplan warnings**, **14 duplicate-index groups**. They are an audit queue, not grounds for blind grants/index deletion. Privileged RPCs need exact owner-policy review after capacity recovery.
- SWLC buckets: `director-character-references`, `director-media`, `director-reference-media`, `jhadina-artifact-derived`, `jhadina-artifact-quarantine`, `jhadina-music-restoration`, `jhadina-safety-evidence`; all private. Bucket presence does not certify object-byte readback or recoverability.
- Separate **Pupsonstuff** project `ztjyewacsmttkzktnyxl` is read/write, ~13 MB, **19 public tables / 17 migrations / 4 private storage buckets**, **3 catalog variants**, **0 orders, creative jobs or fulfillment orders** in checked tables. It has no deployed Edge Functions; storefront launch remains blocked independently by Vercel project-creation authorization and real Stripe/image/sample canaries [#1163](https://github.com/bookieandco/crispy-waddle/issues/1163).

### Work-queue status (no production repairs claimed)

| Gate | Live result | Disposition |
| --- | --- | --- |
| `SUPABASE-PLATFORM.1` | Free-tier quota, read-only; recurring 53100 | **BLOCKED_CAPACITY** |
| `SUPABASE-DB.2` | SQL and out-of-recovery true, but read/write false and no headroom proof | **PARTIAL_READ_ONLY** |
| `SUPABASE-MIGRATIONS.3` | 363 SWLC applied migration records readable; no exact repo reconciliation/test migration | **INVENTORY_ONLY** |
| `SUPABASE-AUTH/API.4` | PostgREST schema cache fails; no authenticated production read/write or sign-in proof | **FAIL** |
| `SUPABASE-EDGE.5` | 19 ACTIVE control-plane functions; memory gateway 500, other functional canaries absent | **FAIL / NOT_TESTED** |
| `SUPABASE-OIDC.6` | Memory gateway accepted request far enough to run DB probe; negative identity and other gateways unproven | **PARTIAL** |
| `SUPABASE-RUNTIME-CONFIG.7` | Director runtime config row present; no validated current worker binding / stale-worker cleanup | **PENDING** |
| `SUPABASE-STORAGE.8` | Seven private buckets listed; no verified objects or isolated restoration | **METADATA_ONLY** |
| `SUPABASE-CROSS-SYSTEM.9` | See inventory below; shared durability is not restored | **NOT_CERTIFIED** |
| `SUPABASE-CAPACITY.10` | Free plan confirmed; no capacity purchase, migration, or retention plan authorized/executed | **OWNER_DECISION_PENDING** |

### Cross-system data and independently blocked work

- **Memory/Personality/Auth**: zero `jhadina_memories`, candidates, reasoning/timeline events; one personality state; phone sign-in/multi-session durability still pending [#1154](https://github.com/bookieandco/crispy-waddle/issues/1154), [#1204](https://github.com/bookieandco/crispy-waddle/issues/1204).
- **Director/Business Factory/Watch**: 12 production runs, four studies, one runtime config; zero generation tasks/executions. Verify authorized worker, immutable render/QC, Watch and feedback receipts after DB recovery [#1099](https://github.com/bookieandco/crispy-waddle/issues/1099).
- **SHARK/Shadow/Money**: zero checked SWLC market events, launch outcome evaluations/observations, actor outcome history and paper-learning rows. Original separate RunPod ledger remains **UNRECOVERED**, never infer that SWLC is the original [#1168](https://github.com/bookieandco/crispy-waddle/issues/1168), [#1178](https://github.com/bookieandco/crispy-waddle/issues/1178). No real orders or financial authorization.
- **Music stream/restore**: one music project, zero `music_tracks`, restoration cases/jobs, and published autoplilot runs in checked tables. Real song ingestion, model outputs, physical SHA-256/Drive readback and owner QC pending [#1142](https://github.com/bookieandco/crispy-waddle/issues/1142).
- **Social/Growth**: zero social accounts/outbox/observations/paid campaigns in checked tables. Database check found **no** `jhadina_social_weekly_stage_children_atomic_v1` or `jhadina_social_weekly_stage_child_outbox_atomic_v1` RPC and no matching weekly/child-outbox tables. New identity/child-approval source remains draft and uncommissioned [#1211](https://github.com/bookieandco/crispy-waddle/issues/1211), [#1222](https://github.com/bookieandco/crispy-waddle/issues/1222).
- **SAM/Overage/Opportunity**: substantial SAM data above; Overage has one surplus record, one owner-verification case, one claimant case, two test/acceptance records, one opportunity. This is **not** legal claimant entitlement, county filing, recovered funds or approved dispatch.
- **OverageOS Homebase**: canonical `NODE_SQLITE` architecture can advance separately with authorized persistent host, source-byte hashes and genuine encrypted independent Drive restore; Supabase Edge authority remains optional until independently commissioned.
- **PupsonStuff**: separate writable DB does **not** imply completed boutique e-commerce. Do not point its app to the shared SWLC database or move live domain/payment keys until the dedicated deployment and Stripe TEST commissioning gates are proven.
- **Gaming/JhadinaTV/Trucker/Staffing**: do not fabricate SWLC schemas as prerequisites. Audit each system's own local/session/Postgres dependencies and verify real source/rights, mobile behavior and standalone deployment independently.

### October 12 source-vs-live migration reconciliation (non-destructive)

The exact `main` repository had **222 SQL migration files / 214 distinct timestamp versions**, with **eight pairs** sharing the same version. SWLC records **363** applied migrations and PupsonStuff separately **17**. Only **35 distinct SWLC-recorded versions** appear among the local Git migration versions; **328 SWLC-recorded versions** have no Git file timestamp match. Conversely, **179 distinct Git timestamps** (representing **186 SQL files**) are not in SWLC's recorded history. Five of those files correspond to recorded versions in the independent PupsonStuff project.

**Interpretation:** filenames and Supabase's migration history are not currently a safe release ledger. **109 Git SQL filenames** have the same descriptive migration name as a recorded SWLC entry but a different timestamp, so treating `not recorded by timestamp` as `SQL not applied` could duplicate or conflict with deployed objects. **Eight duplicate file-version pairs** independently prevent a clean one-file/one-version release mapping. These are *metadata discrepancies*, not proof of missing or incorrectly applied SQL statements.

Read-only, CI-verified prevention is staged in [PR #1227](https://github.com/bookieandco/crispy-waddle/pull/1227): an offline comparator, an exact baseline of the eight existing collision groups, unit tests, and CI that blocks newly introduced duplicate versions without writing a production migration. Keep existing collisions as review debt; do not bulk-rename historical files or `supabase migration repair` without independent schema, object-signature, and content reconciliation. The isolated watchdog SQL repair and its real PostgreSQL 17 lease/concurrency tests are source-verified in [PR #1226](https://github.com/bookieandco/crispy-waddle/pull/1226); it remains explicitly **STAGED, NOT APPLIED** while SWLC is read-only.

### October 12 subsequent coding milestone — read-only recovery false-positive prevented

[Draft PR #1228](https://github.com/bookieandco/crispy-waddle/pull/1228) closes a separate **source safety flaw** in the `/api/internal/supabase/recovery-cert` route: `ready=true` could previously be emitted when all privileged **read-only** table/Auth/bucket/runtime probes returned successfully. Such evidence does not prove a writable SWLC transaction, exact owner/RLS permissions, original object bytes, independently restored encrypted backup or worker liveness. Zero Director object samples and zero runtime bindings were also previously treated as ready. A green read-only report must **never** be elevated to `SUPABASE-CROSS-SYSTEM.9 READY`.

The draft source gate now makes the read-only endpoint **inherently non-certifying** (`certification=NOT_ISSUED`, `ready=false`, HTTP 503); differentiates `REVIEW_REQUIRED` from `BLOCKED`; refuses empty samples / missing runtime configuration; and changes scheduled CI not to announce a cross-system recovered result. A separate independent real write/RLS/restore/worker-evidence workflow must be designed and authorized. [Exact-head CI #38289982087](https://github.com/bookieandco/crispy-waddle/actions/runs/38289982087) passed four Vitest tests and the Python route/workflow safety contract. This is **not** a production deployment or completed platform repair.

**Latest live check 18:18:24 UTC, October 12:** `transaction_read_only=on`, `pg_is_in_recovery()=false`, 1,248,152,723 database bytes. Canonical capacity blocker [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110) remains open.

### Next authorized sequence

1. **Preserve existing SWLC**. Owner/operator chooses managed capacity rescue/platform support or an independently verified encrypted backup and measured retention/migration strategy. No implicit upgrade/spend authority.
2. Verify actual disk/WAL headroom and negative new 53100; return to read/write; show healthy PostgREST schema cache and owner Auth sign-in with explicit RLS allow/deny tests.
3. Independently rehydrate and restore a real encrypted backup; reconcile table counts/hash receipts. Never delete source datasets before restoration proof.
4. Compare 363 applied migrations to main exact source; stage reviewed forward-only deltas (including safety watchdog #1224) on an isolated test database; never blind-push or rewrite applied migrations.
5. Check all active Edge Functions/identities, source-only deployment drift [#1111](https://github.com/bookieandco/crispy-waddle/issues/1111), current Director/SAM worker bindings, Storage physical objects and scheduled workers. Require functional 2xx and persistence receipts, not `ACTIVE` metadata.
6. Re-certify Memory → Auth/Personality → Director/Watch → SAM/Overage → Social → Music → SHARK paper learning using separate real end-to-end canaries. No unattended posting, provider purchases, spend, live trading or owner-safety notification claim before direct evidence.

**Execution boundary:** This audit executed only read-only database, logs, advisors, metadata, GitHub and Vercel inspection and issue documentation; it did **not** purchase capacity, mutate production SQL, delete data, apply migrations, deliver safety alerts, provision a GPU, or restore original Shadow backups.

---

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
