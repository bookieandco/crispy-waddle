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

commission_start=workflow.index("\n  commission:")
settled_start=workflow.index("\n  settled:",commission_start)
commission=workflow[commission_start:settled_start]
for marker in (
    "mode: create",
    "confirmation: CREATE_BILLABLE_DIRECTOR_GPU",
):
    if marker not in commission:
        raise SystemExit("DIRECTOR_RUNPOD_BILLABLE_GATE_MISSING:"+marker)

print("DIRECTOR_RUNPOD_INVENTORY_RECOVERY_CONTRACT_PASS")
