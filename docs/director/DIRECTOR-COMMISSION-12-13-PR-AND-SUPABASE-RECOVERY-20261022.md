# DIRECTOR-COMMISSION.12–.13 — release reconciliation and Supabase isolated replay
Evidence capture: 2026-10-22. Canonical PR #1473. NO live DDL, branch creation, billing, merge or deployment.

## .12 PR and release facts
- GitHub PR #1473 draft; prior exact head 3ff5a5add0ae3312f0ea4f7214637326c48a9f7a, all 9/9 GitHub workflows passed.
- GitHub compare main...Director-branch returned ahead 67, behind 0, main/base 04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61, 50 modified/added files before .12–.13 additions. Patch reviewed for production-admission, RLS/OIDC, preview and renderer changes.
- Existing source preserves clean Artifact Core and owner authority, demo smoke veto, signed Director media, disabled Recast GPU, offline render-plan-only authority and separate Social publication.
- Vercel team/project: crispy-waddle-jhadina-web, id prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco. Verified prior READY production deployments on GitHub main including base SHA 04e965..., and fresh main production deployments on pushes. Merging to main has production deployment consequences. No merge without independent deployment approval and database readiness.
- Source-only merged main code NOT asserted. PR remains draft; no readiness-to-merge claim until new CI and backend release gates pass.

## .13 live read-only SQL and Supabase control plane
- Supabase project kqbkaozfjubkjevdfvic, status ACTIVE_HEALTHY, Postgres 17.6.1.147, region ca-central-1.
- Direct SQL responds, pg_is_in_recovery=false and transaction_read_only=off. Database size pg_database_size pretty output 1340 MB; capacity headroom and independent backup/restore remain UNVERIFIED.
- Migration ledger: 372 applied versions with latest 20261022050646. Newer unrelated JhadinaTV/Social/Creator migrations were applied while required Director source versions 20261003–05 remain absent. The Supabase main branch control-plane status still reports MIGRATIONS_FAILED.
- Confirmed missing: director_workstation_timelines, director_project_inputs, director_screenplay_ingest_proposals, director_screenplay_blueprints, director_watch_jobs, director_project_final_qc_evidence and director_project_final_qc_receipts. Timeline save RPC also absent on earlier exact read.
- Preserved: director_project_memberships and jhadina_artifacts exist, with 16 membership rows across 16 project IDs and one distinct user. Do not reset this state or silently fill migrations table.
- October 5 historical platform audit describes Postgres recovery disk exhaustion (57P03, no space left on device). This is HISTORICAL. Current SQL health is improved; precise latest root cause for persistent MIGRATIONS_FAILED is not independently determined.
- Supabase security advisor returned substantial RLS-without-policy and FK-index notices, including Director tables. Treat no-policy warnings for service-only tables according to effective ACL/RLS; do not create permissive anon/authenticated policies reflexively.
- October 30, 2026 public-schema automatic grants policy change means new Data API tables need explicit role-specific GRANT. Director tables intentionally revoke PUBLIC/anon/authenticated access and grant service_role. Never bulk GRANT all user data.

## Isolated proof authored (.13)
- scripts/director-commission-13-staging.sh starts an ephemeral PostgreSQL 17 container with --network none; it uses synthetic auth/users, membership and artifact fixtures, never connects to production.
- Replays ten existing canonical migrations in dependency order (workstation timeline/RPC, project inputs, screenplay ingest/blueprints, Watch jobs/sources/take-QC, final QC, Watch commissioning, business receipt). Includes restricted idempotency replay for safe CREATE migrations only.
- Verifies required relation presence, all Director tables have RLS, anon/authenticated cannot directly SELECT private Director tables nor EXECUTE privileged save RPC, service_role has precisely authorized event mutation privileges, and owner can initialize/edit revision-fenced timeline.
- Adversarial tests: duplicate mutation idempotence, stale revision rejection, viewer/nonmember edit denial, append-only event receipt count.
- Source script prints staged SQL source hashes and explicit LIVE_DATABASE_UNCHANGED. Running under existing GitHub Director targeted CI; no Supabase billable staging branch or live DB access.
- The earlier schema collision inventory continues to enumerate duplicate timestamp versions. An applied version is NOT proof which same-timestamp source ran. Do not blanket supabase db push, migration repair, delete/rename recorded versions, or reset live project.

## Remaining independently authorized release gates
1. Read staged CI result on the NEW exact head; fix any actual staging failure in the branch. Do not claim success before CI reports it.
2. Produce independently restorable backup of live DB, auth users, relevant Storage metadata AND actual media objects, with hash/restore proof. Supabase Free-tier backup availability must be determined rather than assumed.
3. Reconcile every colliding migration version against 372 existing applied records and resulting objects; determine actual earliest failed migration statement (branch status alone is not the SQL failure). Produce forward-only numbered source migration plan.
4. Obtain distinct approval for production DDL, any billable branch, and downstream deploy; then run only reviewed migrations in dependency order, verify role-specific grants and RLS, full tenant-negative checks and Supabase advisors.
5. Verify authenticated iPhone project creation, screenplay import, timeline save/logout/re-login readback, genuine approved media render and independent QC; publish and paid generation remain separately approval-gated.

Status: .12 reconciliation COMPLETE (no merge intentionally); .13 live forensic audit + isolated replay source COMPLETE, isolated runtime CI and production schema repair NOT YET VERIFIED/AUTHORIZED.