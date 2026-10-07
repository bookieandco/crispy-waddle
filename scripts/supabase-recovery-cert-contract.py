from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ROUTE=ROOT/"apps/jhadina-web/src/app/api/internal/supabase/recovery-cert/route.ts"
WORKFLOW=ROOT/".github/workflows/supabase-production-recovery-cert.yml"

route=ROUTE.read_text()
workflow=WORKFLOW.read_text()

required_route=(
    "authorizedSchedulerRequest",
    "createSchedulerServiceRoleClient",
    "SUPABASE_RECOVERY_CERT_READ_ONLY",
    "canMutate:false",
    "jhadina_memory_candidates",
    "director_project_business_context",
    "director_watch_jobs",
    "director_business_canary_receipts",
    "jhadina_sam_pursuit_snapshots",
    "tax_live_real_case_acceptance_runs",
    "jhadina_spatial_evidence",
    "jhadina_opportunities",
    "jhadina_audit_event",
    "money_purse_charters",
    "director_runtime_config",
    "xn73vwwekavcc6",
    "director-media",
    "director-character-references",
)
for value in required_route:
    assert value in route, f"SUPABASE_RECOVERY_ROUTE_CONTRACT_MISSING:{value}"

for forbidden in (
    ".insert(",
    ".update(",
    ".delete(",
    ".upsert(",
    ".rpc(",
    "apply_migration",
):
    assert forbidden not in route, f"SUPABASE_RECOVERY_ROUTE_MUTATION_FORBIDDEN:{forbidden}"

required_workflow=(
    "id-token: write",
    "jhadina-production-scheduler",
    "/api/health",
    "/api/internal/supabase/recovery-cert",
    "SUPABASE_PLATFORM_STILL_BLOCKED",
    "SUPABASE_PLATFORM_RECOVERY_RETRY_SAFE",
    "--connect-timeout 5 --max-time 12",
    "SUPABASE_CROSS_SYSTEM_RECOVERY_READY",
)
for value in required_workflow:
    assert value in workflow, f"SUPABASE_RECOVERY_WORKFLOW_CONTRACT_MISSING:{value}"

for forbidden in (
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEYS",
    "supabase db push",
    "supabase migration up",
):
    assert forbidden not in workflow, f"SUPABASE_RECOVERY_WORKFLOW_SECRET_OR_MUTATION_FORBIDDEN:{forbidden}"

print("SUPABASE_RECOVERY_CERT_CONTRACT_OK")
