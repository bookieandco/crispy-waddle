#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
workflow=(ROOT/".github/workflows/director-runpod-one-shot.yml").read_text()
gateway=(ROOT/"supabase/functions/jhadina-director-bonez-gateway/index.ts").read_text()
commissioner=(ROOT/"scripts/director-runpod-live-commission.py").read_text()
hunyuan=(ROOT/"services/director-hunyuan/app.py").read_text()

required_workflow=(
    "reconcile_existing:",
    "needs.preflight.outputs.reconcile == 'true'",
    'runpodctl exec python scripts/director-runpod-live-commission.py --pod_id "$POD_ID"',
    '${HUNYUAN_BASE_URL%/}/human-media/health',
    "DIRECTOR_ONE_SHOT_RECONCILE_EXISTING_HUMAN_MEDIA",
    "DIRECTOR_ONE_SHOT_HEALTHY_POD_WAITING_HUMAN_MEDIA_REGISTRATION",
    "DIRECTOR_ONE_SHOT_WAITING_FOR_SWLC_RECOVERY",
    "FALLBACK_POD_ID:",
    "FALLBACK_HUNYUAN_BASE_URL:",
    "FALLBACK_LOCATOR_SHA:",
    "DIRECTOR_ONE_SHOT_USING_SAFE_RUNTIME_LOCATOR_FALLBACK",
    "github-variable-fallback",
    "fallback-disambiguated-existing-pod",
    "existing-runtime-ready-swlc-recovery",
    'elif [[ "$healthy_candidates" -gt 1 ]]',
    '--connect-timeout 5 --max-time 12',
    "DIRECTOR_EXISTING_POD_HUMAN_MEDIA_READY",
)
for marker in required_workflow:
    if marker not in workflow:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_ONE_SHOT_MISSING:"+marker)

start=workflow.index("  reconcile_existing:")
end=workflow.index("\n  commission:",start)
reconcile_block=workflow[start:end]
for forbidden in ("pod create","CREATE_BILLABLE_DIRECTOR_GPU","director-runpod-replacement.yml"):
    if forbidden in reconcile_block:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_RECONCILE_MAY_NOT_CREATE_GPU:"+forbidden)

state_start=workflow.index('          commission=false')
state_end=workflow.index('          {\n            echo "commission=$commission"',state_start)
state_block=workflow[state_start:state_end]
if 'elif [[ "$director_authority_ready" == "true" ]]; then\n            commission=true' not in state_block:
    raise SystemExit("DIRECTOR_HUMAN_MEDIA_COMMISSION_REQUIRES_SWLC_AUTHORITY")
commission_segment=state_block[state_block.index('elif [[ "$director_authority_ready" == "true"'):state_block.index('else',state_block.index('elif [[ "$director_authority_ready" == "true"'))]
if "github-variable-fallback" in commission_segment or "FALLBACK_" in commission_segment:
    raise SystemExit("DIRECTOR_HUMAN_MEDIA_FALLBACK_MAY_NOT_AUTHORIZE_COMMISSION")
ambiguity_start=workflow.index('            elif [[ "$healthy_candidates" -gt 1 ]]')
ambiguity_end=workflow.index('            elif [[ "$inventory_candidates" == "0" ]]',ambiguity_start)
ambiguity_block=workflow[ambiguity_start:ambiguity_end]
for required in (
    'expected_fallback="https://${fallback_pod_id}-8091.proxy.runpod.net"',
    '[[ -n "$fallback_sha"',
    'fallback_matches="$(jq --arg id "$fallback_pod_id"',
    'locator_source="github-variable-fallback"',
    'inventory_state="fallback-disambiguated-existing-pod"',
    'DIRECTOR_ONE_SHOT_USING_SAFE_RUNTIME_LOCATOR_FALLBACK',
):
    if required not in ambiguity_block:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_FALLBACK_AMBIGUITY_CONTRACT_MISSING:"+required)

recovered_start=workflow.index('          elif [[ "$recovered_runtime_ready" == "true" && -n "$registered_pod_id"')
recovered_end=workflow.index('          elif [[ "$inventory_state" == "ambiguous-healthy-existing-pods" ]]',recovered_start)
if 'reconcile=true' not in workflow[recovered_start:recovered_end]:
    raise SystemExit("DIRECTOR_HUMAN_MEDIA_RECOVERED_RUNTIME_MUST_RECONCILE")

for marker in (
    "podId,",
    "humanMediaBaseUrl:",
    'hunyuanBaseUrl?hunyuanBaseUrl+"/human-media":null',
):
    if marker not in gateway:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_PROVISIONING_STATUS_MISSING:"+marker)

for marker in (
    "HUMAN_MEDIA_PATTERN",
    "director-human-media-runpod-bootstrap.sh",
    '"humanMedia":{"state":"unknown"}',
):
    if marker not in commissioner:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_COMMISSIONER_MISSING:"+marker)

for marker in (
    '"/human-media/{path:path}"',
    "human_media_proxy_path_allowed",
    "DIRECTOR_HUMAN_MEDIA_SIDECAR_UNAVAILABLE",
):
    if marker not in hunyuan:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_PROXY_MISSING:"+marker)

print("DIRECTOR_HUMAN_MEDIA_ONE_SHOT_CONTRACT_PASS")
