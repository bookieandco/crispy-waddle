#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
workflow=(ROOT/".github/workflows/director-runpod-one-shot.yml").read_text()

preflight_start=workflow.index("  preflight:")
reconcile_start=workflow.index("\n  reconcile_existing:",preflight_start)
preflight=workflow[preflight_start:reconcile_start]

required=(
    'RUNPOD_API_KEY: ${{ secrets.RUNPOD_API_KEY || secrets.runpod_key }}',
    'runpodctl pod list --all --compute-type GPU -o json',
    'startswith("jhadina-director-")',
    'https://${pod_id}-8091.proxy.runpod.net/health',
    'DIRECTOR_ONE_SHOT_RUNPOD_RECOVERY_SINGLE_HEALTHY',
    'state="reconcile-human-media-recovered"',
    'state="replacement-required-waiting-approval"',
    'state="ambiguous-existing-pods"',
    '/tmp/director-runpod-candidates-safe.json',
    '/tmp/director-runpod-healthy-safe.json',
)
for marker in required:
    if marker not in preflight:
        raise SystemExit("DIRECTOR_RUNPOD_INVENTORY_RECOVERY_MISSING:"+marker)

for forbidden in (
    "runpodctl pod create",
    "runpodctl pod start",
    "runpodctl pod stop",
    "runpodctl pod remove",
    "runpodctl pod delete",
    "CREATE_BILLABLE_DIRECTOR_GPU",
):
    if forbidden in preflight:
        raise SystemExit("DIRECTOR_RUNPOD_INVENTORY_RECOVERY_MUTATION_FORBIDDEN:"+forbidden)

if 'if [[ "$healthy_candidates" == "1" ]]' not in preflight:
    raise SystemExit("DIRECTOR_RUNPOD_INVENTORY_RECOVERY_EXACT_ONE_REQUIRED")
if 'elif [[ "$healthy_candidates" -gt 1 ]]' not in preflight:
    raise SystemExit("DIRECTOR_RUNPOD_INVENTORY_RECOVERY_AMBIGUITY_GATE_REQUIRED")

if "\n  commission:" in workflow:
    raise SystemExit("DIRECTOR_ONE_SHOT_MUST_NOT_CALL_BILLABLE_REPLACEMENT")
if 'uses: ./.github/workflows/director-runpod-replacement.yml' in workflow:
    raise SystemExit("DIRECTOR_ONE_SHOT_MUST_NOT_INVOKE_REPLACEMENT")
for marker in (
    'billableCreationAuthorized:false',
    'recoveredPodId:(if $recoveredPodId=="" then null else $recoveredPodId end)',
    'state="billable-action-waiting-owner-approval"',
    'DIRECTOR_ONE_SHOT_PROVISIONING_ELIGIBLE_SPEND_NOT_APPROVED',
    'if-no-files-found: error',
):
    if marker not in workflow:
        raise SystemExit("DIRECTOR_ONE_SHOT_SAFE_RECEIPT_MISSING:"+marker)
print("DIRECTOR_RUNPOD_INVENTORY_RECOVERY_CONTRACT_PASS")
