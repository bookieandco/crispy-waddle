# SNIPER-REPAIR.01 — SWLC capacity diagnosis and guarded recovery

**Evidence cutoff:** October 14, 2026 21:02 PDT / October 15, 2026 04:02 UTC.
**Project:** Swlc (Supabase ref `kqbkaozfjubkjevdfvic`), not PupsonStuff.
**Mode:** observation-only. This pull request does **not** recover production, authorize money movement, or validate backups.

## Confirmed direct read-only observations

- Supabase organization is on **Free** plan. Free-plan database quota is 500 MiB.
- `pg_database_size(current_database())`: approximately 1,300 MiB.
- `default_transaction_read_only = on` (configuration-file source); `transaction_read_only = on`.
- Repeated PostgreSQL log SQLSTATE `25006` for rejected UPDATE/DELETE.
- Largest relations: `jhadina_sam_catalog` 501 MiB (about 359 MiB TOAST/auxiliary);
  `jhadina_sam_versions` 392 MiB (about 189 MiB auxiliary);
  `jhadina_public_jurisdictions` 107 MiB.
- The two SAM tables alone exceed the 500 MiB Free quota. These are shared
  government-opportunity assets, **not** safe disposable SHARK caches.
- **Archive-only insufficiency:** even a hypothetical full removal of the ~392 MiB
  SAM version-history relation would still leave roughly 900 MiB in this database,
  greater than the Free quota. This is arithmetic, **not** deletion advice;
  TOAST reclamation, foreign keys, downstream dependencies and full backups
  require explicit independent proof. No one-table cleanup can be presumed sufficient.
- Canonical `jhadina_shark_meme_trade_assessments` and `money_shark_runtime_ingress`
  currently exist but contain **zero rows**. The new `jhadina_shark_paper_observation_ingress`
  migration remains unapplied while read-only.
- Project reports ACTIVE_HEALTHY, which does not certify PostgreSQL write capability.

## Existing archive route — **not completed**

Existing draft PR #1229 provides a read-only encrypted one-shot export of
`jhadina_sam_versions`, offline integrity verification and Drive staging.
Verified by listing the owner's connected Drive folders:
- `SWLC-SAM-VERIFIED-ARCHIVER-V2`: scripts and Colab notebook.
- `SWLC-SAM-ARCHIVE-STAGING-2026-10-12/02-ENCRYPTED-ARCHIVES`:
  only a **synthetic** GCM canary.
- `.../03-INDEPENDENT-READBACK-RECEIPTS`: only a **synthetic** canary receipt.
- `SWLC-SAM-HISTORICAL-ARCHIVES`, `SWLC-POSTGRES-ENCRYPTED`,
  `SWLC-TRANSFER-RECEIPTS`: empty at inspection.
A Drive file listing alone is not a verified source backup or a restore.

## Source change

Extended existing `scripts/supabase-recovery-readonly.sql` with additional
SELECT-only quota and relation-allocation evidence. Added hermetic
`ops/meme/test_swlc_capacity_readonly_contract.py` to reject mutating
statements in that audit. No credentials, paid services, live migrations,
trading, DELETE, VACUUM, ALTER, SET, or write operations.

## Guarded remediation / explicit stop conditions

1. Preserve evidence, pause downstream SHARK research ingestion and production
   write commissioning; research can remain separate in the data-only Git branch.
2. Obtain independent, encrypted, full-database backup, perform a real isolated
   PostgreSQL restore, compare schema, row counts and content checksums, then
   independently verify SAM history export before any retention action.
   **Neither task is currently certified.**
3. Review storage budget, SAM foreign keys and version-history retention against
   government-opportunity/overage data requirements; propose **no deletions yet**.
   A 475 MiB conservative database-size target is solely a review heuristic.
4. Owner chooses a no-charge capacity/retention path when feasible or separately
   approves any plan upgrade after seeing exact Supabase charges. **No charges authorized.**
5. After independent restoration and a safe capacity fix, rerun SQL, negative/positive
   RLS, memory/auth checks and schema migration drift reconciliation before applying
   `20261015020000_shark_paper_observation_ingress.sql`.
6. Only then test authenticated SHARK NO_TRADE ingest, replay and durable readback.
   Canonical launch/actor/Money integration and live trades remain blocked.

**Links:** recovery issue #1110, SHARK production gate #1257, archival draft
PR #1229, migration drift draft PR #1227, observation ingress PR #1271.

Reference: https://supabase.com/docs/guides/platform/database-size
