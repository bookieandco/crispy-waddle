# JH-PURSE-COMMERCIAL-MIGRATION-PREFLIGHT.11–.13

Evidence as of 2026-10-21 PDT / 2026-10-22 UTC. This is a **read-only source and live catalog verification**, never a database restoration or production commissioning.

## Pinned dependency stack
- PR #1456: canonical Money integrity and nonexecuting sweep recovery (17/17 CI passed at last review).
- PR #1460: nonexecuting Stripe TEST verifier and owner Purse dashboard (12/12 CI passed at last review).
- PR #1461: LIVE.07-.10 evidence review and upstream Agent Bank research, draft.
- This branch is stacked on #1461. Preserve the three parent heads, no big-tree merge of stale PR #1275 or #1162.

## .11 — Source migration reconciliation
Four existing canonical migration SQL files are pinned in scripts/purse-commercial-manifest.mjs by the **Git blob SHA from current main**. They own 5 tables and 6 RPCs, under canonical Opportunity/Commerce. The source preflight checks DDL, RLS, explicit authenticated read, service role write, public execution revoke, auth.uid() binding, and source-byte drift.

Versions in replay order:
1. 20261002190000 — Side Hustle work orders, commercial receipts and RPCs
2. 20261003143000 — Commerce records and RPC
3. 20261003181500 — Commissioning evidence and RPC
4. 20261003221000 — Digital Product Studio records and RPC

Do not rename, timestamp-bump or blindly apply historical migrations; migration history has later applied versions. Hash mismatch requires a reviewed follow-on fix, not suppressing audit.

## .12 — Database facts
At 2026-10-22 05:28 UTC, connected Supabase SWLC project kqbkaozfjubkjevdfvic responded with read-only queries and transaction_read_only=off. Two prerequisites exist: public.jhadina_opportunities and public.jhadina_venture_records. All five target tables and six canonical RPCs were absent; all four version records missing from supabase_migrations.schema_migrations. Zero Coffers. A DB that accepts writes is NOT an independently restored backup.

Run **SELECT only** scripts/purse-commercial-runtime-preflight.sql. A missing version with a present table, or a mismatched name at an existing version, must be treated as unresolved drift/collision. No history insert, out-of-order auto replay or live DDL.

## .13 — Independent restore and permission acceptance plan
Production remains **BLOCKED** pending actual offsite source backup, independently restored disposable database with full schema and relevant historical rows, checksums/manifest, row-count and constraint readback, an ordered isolated replay, and two real tenant JWT test sessions including negative cross-user read/RPC attempts. A static policy string is not RLS proof; SECURITY DEFINER requires separate signed role/claims tests. Public/anon write grants are prohibited.

After passing that, request separate explicit owner approval for a targeted production migration. Migration security advisories and database readback must be documented on exact reviewed head. Neither this PR nor its tests calls apply_migration, executes SQL mutations, creates billable Supabase branches, connects Stripe, signs wallets, makes ACH/IBAN transfers, credits revenue or authorizes payday.

## Commands for source and metadata review
- node --test scripts/purse-commercial-migration-preflight.test.mjs
- psql "$READ_ONLY_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/purse-commercial-runtime-preflight.sql
- Actual restore/replay uses independent operator-run procedures only after authorization and backup safety review.

## Follow-on operations
1. Real isolated restore + migration rehearsal and reconciliation, backed by timestamped provider/source receipts.
2. Stripe TEST owner-authorized checkout/webhook/refund with independently fetched provider state.
3. Owner iPhone protected navigation acceptance.
4. Real customer order only with approval, independently settled money and cost/tax accounting.
