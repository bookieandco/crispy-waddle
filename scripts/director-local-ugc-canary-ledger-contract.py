#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=ROOT/"supabase/migrations/20261007230500_director_local_ugc_canary_receipts.sql"
LEDGER=ROOT/"apps/jhadina-web/src/lib/opportunities/director-local-ugc-canary-ledger.ts"

sql=MIGRATION.read_text()
code=LEDGER.read_text()

required_sql=(
    "create table if not exists public.director_local_ugc_canary_receipts",
    "snapshot_sha256 text not null",
    "director_local_ugc_canary_snapshot_unique",
    "alter table public.director_local_ugc_canary_receipts enable row level security",
    "revoke all on public.director_local_ugc_canary_receipts",
    "from public,anon,authenticated",
    "grant select,insert on public.director_local_ugc_canary_receipts to service_role",
    "authority='DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONING_EVIDENCE'",
)
for marker in required_sql:
    if marker not in sql:
        raise SystemExit("DIRECTOR_LOCAL_UGC_CANARY_LEDGER_SQL_MISSING:"+marker)

for forbidden in (
    "grant update on public.director_local_ugc_canary_receipts",
    "grant delete on public.director_local_ugc_canary_receipts",
    "grant all on public.director_local_ugc_canary_receipts",
):
    if forbidden in sql.lower():
        raise SystemExit("DIRECTOR_LOCAL_UGC_CANARY_LEDGER_MUTATION_GRANT_FORBIDDEN:"+forbidden)

required_code=(
    "inspectDirectorLocalUgcCanaryCommissioning",
    "DIRECTOR_LOCAL_UGC_CANARY_LEDGER_SENSITIVE_FIELD_FORBIDDEN",
    "DIRECTOR_LOCAL_UGC_CANARY_LEDGER_DECISION_DRIFT",
    "DIRECTOR_LOCAL_UGC_CANARY_LEDGER_SNAPSHOT_HASH_MISMATCH",
    "snapshot_sha256",
    "canCreateCompute!==false",
    "canSpend!==false",
    "canApproveCreative!==false",
    "canPublish!==false",
)
for marker in required_code:
    if marker not in code:
        raise SystemExit("DIRECTOR_LOCAL_UGC_CANARY_LEDGER_CODE_MISSING:"+marker)

print("DIRECTOR_LOCAL_UGC_CANARY_LEDGER_CONTRACT_PASS")
