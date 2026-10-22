# DIRECTOR-CONVERGE.04–.07 — evidence-first schema and runtime recovery
2026-10-22 — source recovery continuation of draft PR #1473

## Verified baseline (live read-only inspections)
- Supabase project: `kqbkaozfjubkjevdfvic`, main/default branch `MIGRATIONS_FAILED` in branch inventory. Live SQL responds, is not read-only, and database is not a standby.
- Current legacy tables `director_production_projects`, `director_project_memberships`, `director_generated_editing_assets`, `jhadina_artifacts` exist with RLS enabled. Project memberships counted 16; preserve all existing records.
- NOT PRESENT in the live database: `director_workstation_timelines`, `director_workstation_timeline_events`, `director_project_inputs`, `director_project_business_context`, `director_screenplay_ingest_proposals`, `director_screenplay_blueprints`, `director_watch_jobs`, `director_watch_sources`, `director_watch_commissioning_receipts`, `director_business_canary_receipts`, `director_local_ugc_canary_receipts`, `director_project_final_qc_evidence`, `director_project_final_qc_receipts`, `director_take_selections`, `director_audio_post_plans`.
- The `save_director_workstation_timeline` stored procedure is NOT PRESENT.
- The live `supabase_migrations.schema_migrations` returned NO rows for `20261003221000`, `20261004193000`, `20261004210000`, `20261004221000`, `20261004224500`, `20261005020000`, `20261005023000` and `20261005024500`.
- The repository contains duplicate fourteen-digit migration timestamps, including `20261003221000`, `20261005023000`, and `20261005024500`. The actual platform failure text and earliest failed statement were not obtained. A name collision is a confirmed structural hazard, not proven as the unique root cause.
- No backup/restore drill, staging replay, authenticated iPhone owner proof, deployed endpoint response or production Watch callback was performed.

## .04 — Forensic migration inventory
- Added `scripts/director-converge-schema-preflight.py` with read-only source enumeration by version: duplicated migration versions, required Director create/RLS/revoke/grant clauses, and the timeline save RPC/member authority/revision fence/append-only events.
- Optional locally provided applied-version JSON is explicitly separate from the source scan; a listed version does not identify which of two colliding source migrations ran.
- Produces a machine-readable `safeForAutomaticReplay:false` result when source versions conflict or applied history has not been supplied. It never contacts Supabase.
- Added synthetic collision, missing-history and no-mutation unit fixtures. Included the checks in the Director targeted CI job.

## .05 — Staging/security acceptance prepared; live apply explicitly BLOCKED
Suggested dependency order after the actual failed migration has been located and a unique-version strategy approved:
1. preserve and independently verify backup and restore of the existing live schema and Director records;
2. isolate a NON-BILLABLE locally controlled Postgres/Supabase instance or separately approve any priced Supabase dev branch;
3. reconcile historical migration ledger entries and every duplicate timestamp without deleting a previously recorded migration or resetting live tables;
4. stage `20261003221000_director_durable_workstation_timeline.sql` (timeline, events, proposals, revision-fenced RPC);
5. stage `20261004193000_director_workstation_project_inputs.sql` (Artifact Core inputs), then `20261004210000_director_screenplay_ingest_proposals.sql` and `20261004221000_director_screenplay_blueprints.sql`;
6. stage `20261004224500_director_watch_jobs.sql` before its subscriptions/commissioning receipts, followed by business context/final QC and other dependent tables in migration-order;
7. demonstrate service-role-only grants and effective RLS, anon/authenticated negative access, actor membership/edit denial, duplicate mutation idempotency, expected-revision concurrency errors, append-only event preservation, and independent restored data readback;
8. obtain separate approval and exact staging acceptance receipts before *any* production DDL or migration-history mutation.

Important: October 30, 2026 Supabase public-schema Data API default-grant changes mean new tables require explicit grants. The referenced migrations use `revoke all on ... from public,anon,authenticated`, service-role grants, and RLS. Absence of a grant is separate from row-level permission; do not broaden anonymous access to remedy denied queries.

## .06 — Owner project durability readiness
- Existing canonical app already contains authenticated clean Artifact Core input binding (`/api/workstation/inputs`), accepted screenplay proposals/blueprints (`/api/workstation/screenplay`), and revision-fenced timeline load/initialize/save (`/api/workstation/timeline`). These are source-level features and still fail when target tables do not exist.
- Added `inspectDirectorDurableStoreReadiness()` and `GET /api/workstation/recovery-readiness?projectId=...`. The API checks authentication, requires the existing project read membership and Vercel runtime service transport, then issues read-only HEAD probes for nine Director stores. It returns only sanitized missing-schema/access/transport blocker types, with no SQL/secret exposure and no cross-project read.
- Even with schema present, the endpoint advertises `durableRoundTripCertified:false`, `independentRestoreCertified:false`, `canEditProduction:false` and `canApplyMigrations:false`. It is never a bypass around staged acceptance.
- Added clean, missing-table and failed-transport tests. Durable post-login readback, screenplay-to-storyboard binding and owner/editor denial/restore proofs remain BLOCKED until authorized schema repair.

## .07 — Director background GitHub OIDC transport isolation
Prior mismatch: Director's dedicated main-branch workflow issues audience `jhadina-director-background`, while the generic Supabase service proxy recognizes Vercel OIDC and `jhadina-production-scheduler` GitHub OIDC. Forwarding the Director workflow bearer as a general service credential fails without direct service-role keys. **Do not add the Director background audience to the generic unrestricted proxy.**
- The existing `authorizedDirectorBackgroundRequest` continues to verify the precise signed main-branch workflow, audience, repository, and event (with optional separately authorized generic scheduler where previously supported).
- Changed `/api/internal/director/background-health`, `/api/internal/director/production-autopilot`, and `/api/internal/director/idle-watch` to use `await createRuntimeServiceRoleClient()` **after** HTTP identity admission. That delegates privileged database access through Vercel production's independent verified OIDC identity or the existing direct service configuration.
- Adjusted diagnostics to report **Vercel runtime eligibility** rather than misleadingly claiming the Director GitHub token is authorized by the generic proxy.
- Added a static source contract asserting authorization-before-runtime-client, no Director GH audience in the generic service proxy, and existing Watch source rights/source-authorization gates. New CI checks are non-mutating.
- No Watch job dispatched, provider billed, callback observed, social media published, or autonomy expanded. Production supervisor remains blocked by `durableRecoveryCertified:false` even if HEAD tables later become reachable.

## Acceptance ledger
| Milestone | Status |
|---|---|
| .04 source migration scanner and retained collision evidence | IMPLEMENTED / CI verdict tracked in PR |
| .05 source RLS/grant/RPC contract | IMPLEMENTED; staged runtime and restore proof BLOCKED |
| .06 authenticated read-only workstation schema endpoint | IMPLEMENTED; live durable round-trip BLOCKED |
| .07 scoped Director background identity bridge | IMPLEMENTED; deployed OIDC/client proof BLOCKED |
| Production DDL, billable branch, GPU, provider call, publish | NOT PERFORMED |

## Next authorized boundary
Obtain the **actual earliest Supabase migration failure and a collision-repair plan**, verify a restorable backup, arrange an explicitly approved/no-cost isolated migration replay, and only then apply the new Director schema to production. Validate a real project: owned clean source artifact → script proposal → accepted blueprint → initialized timeline → revisioned edit → re-login reload → Watch commissioned licensed input and signed callback → durable QC. Production readiness requires actual receipts; this PR alone is not the finish line.
