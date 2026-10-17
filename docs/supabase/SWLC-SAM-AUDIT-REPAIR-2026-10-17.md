# SWLC Supabase P0 / SAM shadow identity repair — October 17, 2026

**Canonical incident:** [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110). Primary detailed repair lane: `docs/supabase/SUPABASE-AUDIT-REPAIR-2026-10-05.md`.

## Confirmed live platform evidence (read-only; no side effects)
- SWLC `kqbkaozfjubkjevdfvic` control plane: `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.147, region `ca-central-1`.
- Direct `select current_database(), now(), pg_is_in_recovery()` via Supabase SQL interface: **FATAL 57P03** (not accepting connections, hot standby disabled).
- PostgreSQL log excerpt near `2026-10-17T19:24:38Z`: repeated `the database system is not accepting connections`; `redo in progress, elapsed time: 5650.84 s`.
- Security and performance advisors also refused with the same `57P03`; cannot certify schema/RLS/grants.
- The control plane shows `jhadina-sam-runtime-gateway` version 1 ACTIVE. This does **not** prove that the unmerged `sam_safety_probe` code is deployed, or that DB reads succeed.
- Root cause per earlier incident investigation: historical database disk exhaustion during WAL recovery. No new direct disk-capacity measurement is possible while SQL is unavailable. No recovery action or capacity change was authorized or performed.

## Source-repair finding: separate SAM shadow OIDC identity

`jhadina-sam-runtime-gateway` allows GitHub OIDC only from `.github/workflows/sam-live-commissioning.yml@refs/heads/main` with audience `jhadina-sam-runtime`. The proposed manual `sam-safety-shadow.yml` was requesting the same audience, but could not match the strictly pinned `workflow_ref` claim. Weakening that privileged writer-capable gateway would introduce an unnecessary second authority.

### Safe code change

- New `supabase/functions/jhadina-sam-shadow-gateway/index.ts` **only** allows the exact GitHub Actions `workflow_dispatch` shadow workflow, repository ID and owner ID, immutable subject, main ref and audience `jhadina-sam-shadow` after cryptographic GitHub JWKS verification. Invalid callers get HTTP 401.
- Only one operation, POST `{"action":"probe_db"}`, is allowed; responds 200 only when the actual SAM scan table read succeeds. No CRUD passthrough, market API, generic RPC, mutable operations or other tenant data.
- GitHub workflow and CLI now request the **separate** audience, use an exact fixed origin, and default to no external feed reads. Existing production SAM OIDC constraints remain unchanged.
- **Deployment prerequisite:** this new Edge function must be deployed with platform `verify_jwt=false` to allow the external GitHub OIDC token to reach the function's strict validation. This is NOT anonymous authorization. Verify the exact function source/claims first, then deploy only by an authorized operator as part of a reviewed post-recovery procedure. No function was deployed from this branch.
- **Do not add the new shadow function to the existing general SAM gateway whitelist.** Do not add wildcard workflow subjects, replace claim checks with a shared secret, or expose the database service key to the client.

## SAM scheduled-ingest guard

- `assertSamPrewriteDbReady` issues a bounded HEAD/SELECT through the **existing production GitHub OIDC gateway** and refuses errors, HTTP failures, empty/ambiguous responses or thrown transport failures.
- The guard executes **before** `failStaleSamScanRuns`, market bootstrap and provider enrichment. It prevents scheduled SAM database-write attempts when SWLC is returning `57P03`.
- This gate proves merely that one allowed read reached Postgres. It does **not** certify available free disk, migration integrity, authenticated RLS, absence of WAL replay, complete backups, or full production admission.
- Automated tests cover fake `57P03`, malformed and error HTTP replies, thrown connections and ordering before mutation.

## Remaining operator repair order

1. **SUPABASE-PLATFORM.1 (blocked):** obtain adequate disk headroom or Supabase support intervention **after explicit owner cost/operational approval**. No speculative upgrade or blind deletion.
2. **SUPABASE-DB.2:** independently verify SQL connectivity, `pg_is_in_recovery() = false`, actual free disk, no new disk exhaustion, WAL and relation inventory, backup/restore evidence. No DDL yet.
3. **SUPABASE-MIGRATIONS.3 / AUTH/API.4:** verify migration history vs repo, grants, RLS, Auth startup and PostgREST schema. Fail closed on drift.
4. **SUPABASE-EDGE.5:** confirm exact source revision and `verify_jwt` deployment settings for the new shadow gateway and the production gateway independently. Probe wrong audience/workflow claims (must be denied) and actual shadow database read (must succeed) without exposing sensitive data.
5. **SUPABASE-CROSS-SYSTEM.6–.9:** re-run existing canonical read-only recovery-certification automation, then separately commission SAM manual shadow and other DB-dependent systems.
6. Merge/reconcile the open SAM draft PR dependency chain against updated main with exact-head CI and operator review; no cross-stack shortcut or assumed production green.

**This issue is marked and source repairs are prepared. The production database is still down, so no live shadow, migrations, Edge rollout, data cleanup, memory persistence, communication, bidding or money movement are authorized.**
