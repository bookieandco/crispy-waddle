#!/usr/bin/env python3
"""Static safety contract for Director's guarded RunPod replacement workflow."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/".github/workflows/director-runpod-replacement.yml"
LIVE=ROOT/".github/workflows/director-runpod-live-commission.yml"
BOOTSTRAP=ROOT/"scripts/director-hunyuan-runpod-bootstrap.sh"
LAMBDA_BOOTSTRAP=ROOT/"scripts/director-hunyuan-lambda-bootstrap.sh"
SOURCE_PINS=ROOT/"scripts/director-hunyuan-source-pins.sh"
BONEZ_GATEWAY=ROOT/"supabase/functions/jhadina-director-bonez-gateway/index.ts"

replacement=WORKFLOW.read_text()
live=LIVE.read_text()
bootstrap=BOOTSTRAP.read_text()
lambda_bootstrap=LAMBDA_BOOTSTRAP.read_text()
source_pins=SOURCE_PINS.read_text()
bonez_gateway=BONEZ_GATEWAY.read_text()

required_replacement=(
    "workflow_dispatch:",
    "workflow_call:",
    "id-token: write",
    "REQUESTED_MODE: ${{ inputs.mode || 'plan' }}",
    "REQUESTED_GPU_ID: ${{ inputs.gpu_id || 'AUTO' }}",
    "MAX_GPU_HOURLY_USD: ${{ inputs.max_hourly_usd || '1.00' }}",
    'MIN_GPU_MEMORY_GB: "24"',
    "DIRECTOR_RUNPOD_GPU_SELECTED:",
    '--gpu-id "$SELECTED_GPU_ID"',
    "--country-code US",
    "/tmp/director-selected-gpu.json",
    "if: env.REQUESTED_MODE == 'create'",
    'CREATE_BILLABLE_DIRECTOR_GPU',
    'workflow_dispatch)',
    'workflow_call)',
    'DIRECTOR_RUNPOD_AUTOMATED_CREATE_REQUIRES_MAIN',
    'DIRECTOR_RUNPOD_CREATE_REQUIRES_EXPLICIT_OR_ARMED_AUTHORITY',
    "audience=director-runpod-provisioning",
    "DIRECTOR_RUNPOD_PROVISIONING_AUTHORITY_UNAVAILABLE_PLAN_ONLY",
    "DIRECTOR_RUNPOD_CREATE_REQUIRES_LIVE_SWLC_AUTHORITY",
    "runtimeConfigWritable",
    "runtime_config_writable",
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
    "DIRECTOR_HUNYUAN_WORKER_TOKEN",
    "MUSIC_RESTORATION_WORKER_TOKEN",
    "hunyuanWorkerToken",
    "runpod-provisioning-tokens",
    "secrets.DIRECTOR_SPEAKER_QC_TOKEN",
    "DIRECTOR_SPEAKER_QC_TOKEN",
    "speakerQcToken",
    "secrets.HF_TOKEN",
    "HF_TOKEN:",
    "HF_CREDENTIAL_SOURCE",
    "RUNPOD_HF_SECRET_NAME",
    "HUGGINGFACE_TOKEN",
    "--stop-after",
)
for value in forbidden_replacement:
    if value in replacement:
        raise SystemExit(f"DIRECTOR_RUNPOD_REPLACEMENT_CONTRACT_FORBIDDEN:{value}")

for value in (
    "speakerQcToken",
    "DIRECTOR_SPEAKER_QC_PROVISION_TOKEN_REQUIRED",
    "hunyuanWorkerToken",
    "DIRECTOR_HUNYUAN_PROVISION_TOKEN_REQUIRED",
    '"runpod-provisioning-tokens"',
):
    if value in bonez_gateway:
        raise SystemExit(f"DIRECTOR_RUNPOD_GATEWAY_STATIC_TOKEN_FORBIDDEN:{value}")
for value in (
    'runtimeConfigWritable:false',
    'DIRECTOR_RUNTIME_CONFIG_UNAVAILABLE',
    'withDeadline(',
    'hunyuanAuthMode:"vercel-oidc"',
    'speakerQcAuthMode:"vercel-oidc"',
    'GITHUB_ONE_SHOT_WORKFLOW_REF',
    'GITHUB_PROVISIONING_STATUS_WORKFLOW_REFS',
    'authorizeGithubProvisioner(req,action)',
):
    if value not in bonez_gateway:
        raise SystemExit(f"DIRECTOR_RUNPOD_GATEWAY_OIDC_AUTH_MODE_REQUIRED:{value}")
for value in (
    'const retireLegacyTokens=await withDeadline(',
    '.delete()',
    '.in("key",[HUNYUAN_RUNTIME_TOKEN_KEY,SPEAKER_QC_TOKEN_KEY])',
):
    if value not in bonez_gateway:
        raise SystemExit(f"DIRECTOR_RUNPOD_GATEWAY_LEGACY_TOKEN_RETIREMENT_REQUIRED:{value}")

required_source_pins=(
    "DIRECTOR_HUNYUAN_SIGLIP_SOURCE='google/siglip-so400m-patch14-384'",
    "DIRECTOR_HUNYUAN_SIGLIP_REVISION='538da78b54e0d958422c4b1d5562a21595f4adce'",
)
for value in required_source_pins:
    if value not in source_pins:
        raise SystemExit(f"DIRECTOR_HUNYUAN_OPEN_SIGLIP_PIN_MISSING:{value}")

required_bootstrap=(
    'source "$SCRIPT_DIR/director-hunyuan-source-pins.sh"',
    'SIGLIP_SOURCE="$DIRECTOR_HUNYUAN_SIGLIP_SOURCE"',
    'SIGLIP_REVISION="$DIRECTOR_HUNYUAN_SIGLIP_REVISION"',
    'SIGLIP_ROOT="$MODEL_ROOT/vision_encoder/siglip"',
    'SiglipVisionModel.from_pretrained(source, revision=revision)',
    'SiglipImageProcessor.from_pretrained(source, revision=revision)',
    'model.save_pretrained(image_encoder',
    'processor.save_pretrained(feature_extractor)',
    '"hidden_size": 1152',
    '"num_hidden_layers": 27',
    '"image_size": 384',
    '"patch_size": 14',
    'root / "SOURCE.json"',
    '"license": "apache-2.0"',
)
forbidden_bootstrap=(
    "black-forest-labs/FLUX.1-Redux-dev",
    "HF_TOKEN",
)

for label, script in (("runpod", bootstrap), ("lambda", lambda_bootstrap)):
    for value in required_bootstrap:
        if value not in script:
            raise SystemExit(f"DIRECTOR_HUNYUAN_OPEN_SIGLIP_CONTRACT_MISSING:{label}:{value}")
    for value in forbidden_bootstrap:
        if value in script:
            raise SystemExit(f"DIRECTOR_HUNYUAN_OPEN_SIGLIP_CONTRACT_FORBIDDEN:{label}:{value}")
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
for value in (
    "id: allocation",
    'echo "ready=false" >> "$GITHUB_OUTPUT"',
    "steps.allocation.outputs.ready == 'true'",
    "DIRECTOR_RUNPOD_ZERO_GPU_CAPACITY_BLOCKED",
):
    if value not in live:
        raise SystemExit(f"DIRECTOR_RUNPOD_LIVE_WAIT_STATE_CONTRACT_MISSING:{value}")
for value in (
    "secrets.HF_TOKEN",
    "HF_TOKEN",
    "GITHUB_HF_TOKEN",
    "secrets.DIRECTOR_SPEAKER_QC_TOKEN",
    "GITHUB_DIRECTOR_SPEAKER_QC_TOKEN",
    "secrets.DIRECTOR_HUNYUAN_WORKER_TOKEN",
    "GITHUB_DIRECTOR_HUNYUAN_WORKER_TOKEN",
    "secrets.MUSIC_RESTORATION_WORKER_TOKEN",
    "GITHUB_MUSIC_RESTORATION_WORKER_TOKEN",
):
    if value in live:
        raise SystemExit(f"DIRECTOR_RUNPOD_LIVE_STATIC_CREDENTIAL_FORBIDDEN:{value}")

print("DIRECTOR_RUNPOD_REPLACEMENT_CONTRACT_OK")
