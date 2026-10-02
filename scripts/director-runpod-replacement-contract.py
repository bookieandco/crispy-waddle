#!/usr/bin/env python3
"""Static safety contract for Director's guarded RunPod replacement workflow."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/".github/workflows/director-runpod-replacement.yml"
LIVE=ROOT/".github/workflows/director-runpod-live-commission.yml"

replacement=WORKFLOW.read_text()
live=LIVE.read_text()

required_replacement=(
    "workflow_dispatch:",
    "id-token: write",
    "REQUESTED_MODE: ${{ inputs.mode || 'plan' }}",
    "REQUESTED_GPU_ID: ${{ inputs.gpu_id || 'AUTO' }}",
    "MAX_GPU_HOURLY_USD: ${{ inputs.max_hourly_usd || '1.00' }}",
    'MIN_GPU_MEMORY_GB: "24"',
    "RUNPOD_HF_SECRET_NAME: ${{ inputs.hf_secret_name || 'HUGGINGFACE_TOKEN' }}",
    "DIRECTOR_HF_CREDENTIAL_SOURCE:",
    "DIRECTOR_HF_CREDENTIAL_REQUIRED",
    "{{ RUNPOD_SECRET_${RUNPOD_HF_SECRET_NAME} }}",
    "/tmp/director-hf-credential-source.json",
    "DIRECTOR_RUNPOD_GPU_SELECTED:",
    '--gpu-id "$SELECTED_GPU_ID"',
    "--country-code US",
    "/tmp/director-selected-gpu.json",
    "if: env.REQUESTED_MODE == 'create'",
    'CREATE_BILLABLE_DIRECTOR_GPU',
    'if [[ "$GITHUB_EVENT_NAME" != "workflow_dispatch" ]]',
    "audience=director-runpod-provisioning",
    "runpodctl pod create",
    "DIRECTOR_OLD_POD_DELETE_NOT_REQUESTED",
    "/tmp/director-old-pod-safe.json",
    "/tmp/director-new-pod-create-safe.json",
    "/tmp/director-new-pod-safe.json",
)
for value in required_replacement:
    if value not in replacement:
        raise SystemExit(f"DIRECTOR_RUNPOD_REPLACEMENT_CONTRACT_MISSING:{value}")

forbidden_replacement=(
    "runpodctl pod delete",
    "secrets.SUPABASE_SERVICE_ROLE_KEY",
    "secrets.DIRECTOR_HUNYUAN_WORKER_TOKEN",
    "secrets.DIRECTOR_SPEAKER_QC_TOKEN",
)
for value in forbidden_replacement:
    if value in replacement:
        raise SystemExit(f"DIRECTOR_RUNPOD_REPLACEMENT_CONTRACT_FORBIDDEN:{value}")

upload=replacement.split("- name: Upload replacement receipts",1)
if len(upload)!=2:
    raise SystemExit("DIRECTOR_RUNPOD_REPLACEMENT_UPLOAD_BLOCK_MISSING")
upload_block=upload[1]
for raw in (
    "/tmp/director-old-pod.json",
    "/tmp/director-old-pod-final.json",
    "/tmp/director-new-pod-create.json",
    "/tmp/director-new-pod.json",
    "/tmp/director-runpod-provision-tokens.json",
    "/tmp/runpod-secrets-query.json",
    "/tmp/runpod-secrets-response.json",
):
    if raw in upload_block:
        raise SystemExit(f"DIRECTOR_RUNPOD_REPLACEMENT_RAW_SECRET_ARTIFACT_FORBIDDEN:{raw}")

live_upload=live.split("- name: Upload Director live receipts",1)
if len(live_upload)!=2:
    raise SystemExit("DIRECTOR_RUNPOD_LIVE_UPLOAD_BLOCK_MISSING")
if "/tmp/director-pod-allocation.json" in live_upload[1]:
    raise SystemExit("DIRECTOR_RUNPOD_LIVE_RAW_ALLOCATION_ARTIFACT_FORBIDDEN")
if "/tmp/director-pod-allocation-safe.json" not in live_upload[1]:
    raise SystemExit("DIRECTOR_RUNPOD_LIVE_SAFE_ALLOCATION_ARTIFACT_REQUIRED")

print("DIRECTOR_RUNPOD_REPLACEMENT_CONTRACT_OK")
