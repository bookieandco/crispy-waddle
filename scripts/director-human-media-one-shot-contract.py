#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
workflow=(ROOT/".github/workflows/director-runpod-one-shot.yml").read_text()
gateway=(ROOT/"supabase/functions/jhadina-director-bonez-gateway/index.ts").read_text()
commissioner=(ROOT/"scripts/director-runpod-live-commission.py").read_text()
hunyuan=(ROOT/"services/director-hunyuan/app.py").read_text()

required_workflow=(
    "reconcile-existing:",
    "needs.preflight.outputs.reconcile == 'true'",
    'runpodctl exec python scripts/director-runpod-live-commission.py --pod_id "$POD_ID"',
    '\${HUNYUAN_BASE_URL%/}/human-media/health',
    "DIRECTOR_ONE_SHOT_RECONCILE_EXISTING_HUMAN_MEDIA",
    "DIRECTOR_EXISTING_POD_HUMAN_MEDIA_READY",
)
for marker in required_workflow:
    if marker not in workflow:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_ONE_SHOT_MISSING:"+marker)

start=workflow.index("  reconcile-existing:")
end=workflow.index("\n  commission:",start)
reconcile_block=workflow[start:end]
for forbidden in ("pod create","CREATE_BILLABLE_DIRECTOR_GPU","director-runpod-replacement.yml"):
    if forbidden in reconcile_block:
        raise SystemExit("DIRECTOR_HUMAN_MEDIA_RECONCILE_MAY_NOT_CREATE_GPU:"+forbidden)

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
