# DB-RECOVER.01–.08 — SWLC actual reconciliation and release holds

**Observed October 14, 2026 PDT / 2026-10-15 UTC. Source branch:** `feat/biz-purse-01-12-governed-foundation-20261014`; [draft PR #1275](https://github.com/bookieandco/crispy-waddle/pull/1275). **Production status:** BLOCKED; no SQL writes, no migration repair, no archive restoration or hosting activation.

This handoff distinguishes executable code, read-only evidence, and genuinely missing third-party/owner proofs. It is not a claim that the live database has been restored.

## Completed code/read-only stages

| Milestone | Evidence produced | Result |
| --- | --- | --- |
| DB-RECOVER.01 — Pin source/recorded history | [Source snapshot](./DB-RECOVER-SWLC-MIGRATION-SNAPSHOT.json) of **223** migration SQL blobs (215 distinct version numbers), plus **365** read-only recorded SWLC migration version/name pairs | Coded and observed; not a complete migration history reconstruction |
| .02 — Collision analysis | Exactly **eight** duplicate 14-digit GitHub versions, source paths and Git blob SHAs, plus one remote name: `20260902013135_director_generation_submission_outbox` | All 8 require review; do NOT arbitrarily renumber applied files |
| .03 — File integrity / CI guard | `scripts/db-recover-01-08-reconcile.mjs` verifies each tracked SQL file's real Git blob hash and refuses newly added/changed migration bytes without a reviewed snapshot; regression tests run in Opportunity Core CI | Code check only, not restore |
| .04 — Actual read-only object existence | [Representative SQL probe](../../scripts/db-recover-04-collision-object-probe.sql) and [snapshot](./DB-RECOVER-SWLC-COLLISION-OBJECT-SNAPSHOT.json): **8 of 16** indicative public schema objects existed; **8 absent** | Catalog presence does **not** establish which migration statements executed or whether current privileges match the source |
| .05 — Backup discovery / eligibility | Checked private Google Drive SWLC archive folders; see below | BLOCKED: no complete independently verifiable SWLC dump in checked folders |
| .06 — Disposable replay & tenant-RLS tests | Existing `scripts/biz-purse-14-local-owner-test.mjs`, `supabase/tests/biz-purse-14-two-owner-local-only.sql` and `supabase/recovery/biz-purse-15-order-journal.local.sql` | Ready for owner-approved isolated environment; **not executed** |
| .07 — Production readback | Existing `scripts/biz-purse-14-security-probe.sql` and `scripts/biz-purse-readonly-probe.sql` | **All five commercial tables still missing** in latest SWLC read-only query |
| .08 — Final production admission | `scripts/biz-purse-23-db-admission.mjs` and this handoff | BLOCKED: no independent restoration, approved ordered migration plan or authentic cross-owner/security canary |

## Exact collision inventory (no automatic fix)

- `20260902013135`: Director submission outbox **versus** generation submission reservation function. SWLC migration history records the **outbox** name only; **both** representative objects exist in the catalog. Some SQL may have been applied outside that migration row. Do not mark the second migration as applied or run the reservation function blind.
- `20260920190000`: director production authority table and safety runtime proofs table. Both representative tables exist despite no matching history row.
- `20260920200000`: director media review **absent**; Money bank connections **present**.
- `20260920210000`: director review transitions **absent**; Money owned-account IDs function **present**.
- `20261001120000`: government demand radar **present** and official domains registry **present**.
- `20261003221000`: Director workstation timeline **absent**; Digital Product Studio registry **absent**.
- `20261005023000`: Director post-task receipts **absent**; director watch commissioning receipts **absent**.
- `20261005024500`: Director business canary receipts **absent**; visual annotation tasks **absent**.

For every collision, the required reviewed remedy is **(a)** compare full original SQL content and dependencies against live schema/function definitions, privileges and other remote-history entries, **(b)** determine whether its behavior exists via another migration or manual operation, **(c)** stage missing SQL under a disposable-only recovery path with SHA proof, **(d)** independently restore and run a local replay, and **(e)** only then generate reviewed collision-free future migration(s) using the installed CLI's current `supabase migration new --help` flow. Never rewrite recorded production versions or use `migration repair --status applied` to conceal missing DDL.

## Backup verification — Google Drive checked

- [SWLC-POSTGRES-ENCRYPTED](https://drive.google.com/drive/folders/1kNddFFBmVQ21-1MpNzxSIC-QoR48cjW_): **0 files**.
- [SWLC-SAM-HISTORICAL-ARCHIVES](https://drive.google.com/drive/folders/15VI26nvzdPTVXdrVj8NdvlbxaBk5Crlf): **0 files**.
- [SWLC-SAM-ARCHIVE-STAGING-2026-10-12](https://drive.google.com/drive/folders/1b-DZZOwzzavYS-7uh8qIi7vgZeR9QnyD): contains an archive verifier/notebook and subfolders. Its encrypted archive subfolder held **one explicitly synthetic AES-GCM canary** (192 bytes), plus a synthetic receipt in the readback folder. These are NOT a SWLC Postgres backup or independently restored database.
- [SWLC-SAM-VERIFIED-ARCHIVER-V2](https://drive.google.com/drive/folders/1kXlWv8pUc3q6SA7Y1HO9yf5v30Jo6WW5): notebook and archiver/verification scripts (no verified source dump). Existing scripts do not prove they have run against SWLC.

These observations are limited to accessible files and those searched locations. They do **not** establish that backups are impossible or that none exist with another provider.

A genuine backup must capture the required PostgreSQL roles/extensions/schema/table contents, related auth and storage metadata, and separately confirm off-database Supabase Storage object bytes and configuration where needed. It needs original archive-byte SHA-256, encrypted private custody, a different operator's verification and an **actual isolated restore with readback**, not merely an SQL export log or a positive self-assertion. Do not upload unencrypted customer data, credentials or DB connection strings into GitHub.

## Next strict operational sequence

1. Secure an **actual current SWLC source backup** through a supported provider method or trusted owner-controlled Postgres client without incurring unapproved hosting/backup charges. Record archive bytes/hash and capture time. Confirm sufficient source coverage; encrypt at rest and in transit.
2. Independently verify backup byte integrity and restore to **disposable local Postgres** named `biz_purse_recovery_*`; never use the live SWLC host for tests. Validate table counts/schema/index/function/privilege readback and each component required by the deployed app.
3. Reconcile **365 recorded versions vs 215 unique source versions**, including the 330 remote-only and 180 local-only version numbers at this observation. Do not imply that a matching version proves the SQL file actually executed.
4. Stage a dependency-ordered **manual SQL repair plan** only after independent source, remote and local-replay review. All eight collisions must have explicit signed disposition and correct SQL-content evidence. No `db push`, `migration repair` or schema modifications on SWLC before this.
5. Run actual disposable RLS tests as two authenticated users for each intended exposed relation, plus service-only function EXECUTE grants, safe `search_path`, refund uniqueness and order replay/racing behavior. The test fixtures and `auth.uid()` must be verified against installed Supabase bootstrap.
6. Review Supabase October 2026 Data API explicit-GRANT defaults before exposing new tables; explicit `anon`/`authenticated` privileges and least-privilege RLS must agree with the intended app client. Do not blanket-grant roles to fix missing table access.
7. Obtain separate owner authorization of exact SQL hashes, risk/rollback, cost and maintenance window; execute the controlled migration, verify exact production readback with fresh independent tool queries, and preserve evidence.
8. Only after SQL certification proceed to Stripe TEST signed payment canaries, accepted real customer orders, owner-protected custody and real unattended host drills.

## Safety status

No genuine source backup or independent restore found. Therefore **DB-RECOVER.05–.08 cannot honestly be marked complete** even if code inventory and CI pass. The next real-world dependency is the owner-authorized backup/restore environment. PR #1275 remains draft and [Supabase repair issue #1276](https://github.com/bookieandco/crispy-waddle/issues/1276) remains open. No charges, transfers, trades or production DDL authorized.

Official references: https://supabase.com/docs/guides/deployment/database-migrations and https://supabase.com/docs/guides/api/securing-your-api
