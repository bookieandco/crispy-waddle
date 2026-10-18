from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ROUTE=ROOT/"apps/jhadina-web/src/app/api/internal/supabase/recovery-cert/route.ts"
WORKFLOW=ROOT/".github/workflows/supabase-production-recovery-cert.yml"
AUTH=ROOT/"apps/jhadina-web/src/lib/internal-scheduler-auth.ts"

route=ROUTE.read_text()
workflow=WORKFLOW.read_text()
auth=AUTH.read_text()

required_route=(
    "authorizedSupabaseRecoveryRequest",
    "createRuntimeServiceRoleClient",
    "SUPABASE_RECOVERY_CERT_READ_ONLY",
    "canMutate:false",
    "jhadina_memory_candidates",
    "director_project_business_context",
    "director_watch_jobs",
    "director_business_canary_receipts",
    "director_watch_commissioning_receipts",
    "director_local_ugc_canary_receipts",
    "director_workstation_timelines",
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
    "jhadina-supabase-recovery-cert",
    "Request recovery-only workflow OIDC",
    "/api/health",
    "/api/internal/supabase/recovery-cert",
    "SUPABASE_PLATFORM_STILL_BLOCKED",
    "SUPABASE_PLATFORM_RECOVERY_RETRY_SAFE",
    "--connect-timeout 5 --max-time 12",
    "SUPABASE_CROSS_SYSTEM_RECOVERY_READY",
    ".durableRecoveryCertified == true",
    ".independentRestoreCertified == true",
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

# An authenticated GitHub workflow only accesses this GET route. It must not
# gain general scheduler authority or direct service-role proxy authority.
assert "authorizedSchedulerRequest" not in route
assert "createSchedulerServiceRoleClient" not in route
assert "await createRuntimeServiceRoleClient()" in route
assert "export async function GET" in route
assert "export async function POST" not in route
assert "core.getIDToken('jhadina-supabase-recovery-cert')" in workflow
assert 'core.getIDToken(\'jhadina-production-scheduler\')' not in workflow
assert "supabase-production-recovery-cert.yml@refs/heads/main" in auth
assert "jhadina-supabase-recovery-cert" in auth
assert "authorizedGitHubWorkflowRequest(request" in auth
assert "apps/jhadina-web/src/lib/internal-scheduler-auth.ts" in workflow
assert "durableRecoveryCertified:false" in route
assert "independentRestoreCertified:false" in route
assert "READ_ONLY_PROBES_READY_AUDIT_PENDING" in route
assert ".durableRecoveryCertified == true" in workflow
assert ".independentRestoreCertified == true" in workflow
print("SUPABASE_RECOVERY_CERT_CONTRACT_OK")
