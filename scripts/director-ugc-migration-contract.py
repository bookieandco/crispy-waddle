#!/usr/bin/env python3
"""Fail-closed source contract for the unapplied Director LOCAL-UGC ledger DDL.

No database credentials and no migration execution. Catches the corrupted SQL
trailing block and open SHA-256 check that blocked the 2026-10-14 audit.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "supabase/migrations/20261007230500_director_local_ugc_canary_receipts.sql"
source = path.read_text(encoding="utf-8")

assert source.count("create table if not exists public.director_local_ugc_canary_receipts") == 1, "TABLE_DECLARATION_NOT_UNIQUE"
assert source.count("comment on table public.director_local_ugc_canary_receipts is") == 1, "MIGRATION_DUPLICATE_TRAILING_BLOCK"
assert source.count("create unique index if not exists director_local_ugc_canary_snapshot_unique") == 1, "IDEMPOTENT_LEDGER_INDEX_REQUIRED"
assert source.count("create policy director_local_ugc_canary_receipts_service_role_only") == 1, "RESTRICTIVE_SERVICE_POLICY_REQUIRED"
assert source.count("alter table public.director_local_ugc_canary_receipts enable row level security") == 1, "LEDGER_RLS_REQUIRED"
assert "grant select,insert on public.director_local_ugc_canary_receipts to service_role;" in source, "SERVICE_GRANTS_REQUIRED"
assert "revoke all on public.director_local_ugc_canary_receipts" in source, "OWNER_SCOPE_REQUIRED"
assert re.search(r"check\s*\(snapshot_sha256\s*~\s*'\^\[a-f0-9\]\{64\}\$'\)", source), "SHA256_CONSTRAINT_MALFORMED"
assert "check (jsonb_typeof(commissioning_decision)='object')" in source, "COMMISSIONING_DECISION_JSON_REQUIRED"
assert "check (jsonb_typeof(canary_state)='object')" in source, "CANARY_STATE_JSON_REQUIRED"
assert source.strip().endswith("never grants compute, spend, creative approval, publication, or wagering authority.';"), "UNEXPECTED_SQL_TRAILING_TEXT"

# This DDL intentionally has no SECURITY DEFINER routines or operator-granted action rail.
for forbidden in ("security definer", "grant all", "to anon;", "to authenticated;", "truncate ", "drop table"):
    assert forbidden not in source.lower(), f"LEDGER_AUTHORITY_EXPANSION_FORBIDDEN:{forbidden}"

# The only unmatched single quotes allowed are SQL-doubled escapes; this
# migration is flat DDL, with no dollar-quoted function body.
without_doubled_quotes = source.replace("''", "")
assert without_doubled_quotes.count("'") % 2 == 0, "SQL_UNTERMINATED_STRING"
print("DIRECTOR_LOCAL_UGC_MIGRATION_SOURCE_CONTRACT_PASS")
