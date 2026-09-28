#!/usr/bin/env bash
set -euo pipefail

: "${LAMBDA_API_KEY:?LAMBDA_API_KEY is required}"
: "${LAMBDA_REGION:?LAMBDA_REGION is required, e.g. us-west-1}"
: "${LAMBDA_SSH_KEY_NAME:?LAMBDA_SSH_KEY_NAME is required}"
: "${DIRECTOR_GPU_MAX_HOURLY_USD:?DIRECTOR_GPU_MAX_HOURLY_USD is required}"

INSTANCE_TYPE="${LAMBDA_INSTANCE_TYPE:-gpu_1x_a6000}"
INSTANCE_NAME="${LAMBDA_INSTANCE_NAME:-jhadina-director-hunyuan}"
MAX_HOURLY="${DIRECTOR_GPU_MAX_HOURLY_USD}"

declare -A KNOWN_HOURLY=(
  [gpu_1x_a6000]="1.09"
  [gpu_1x_a10]="1.29"
  [gpu_1x_a100_sxm4]="1.99"
  [gpu_1x_a100]="1.99"
  [gpu_1x_h100_pcie]="3.29"
  [gpu_1x_h100_sxm5]="4.29"
  [gpu_1x_rtx6000]="0.69"
)

if [[ -n "${KNOWN_HOURLY[$INSTANCE_TYPE]:-}" ]]; then
  python3 - "$MAX_HOURLY" "${KNOWN_HOURLY[$INSTANCE_TYPE]}" <<'PY'
import sys
cap=float(sys.argv[1]); price=float(sys.argv[2])
if price > cap:
    raise SystemExit(f"DIRECTOR_GPU_COST_CEILING_EXCEEDED: price={price:.2f} cap={cap:.2f}")
PY
fi

payload="$(python3 - "$LAMBDA_REGION" "$INSTANCE_TYPE" "$LAMBDA_SSH_KEY_NAME" "$INSTANCE_NAME" <<'PY'
import json,sys
region,instance_type,key,name=sys.argv[1:]
print(json.dumps({
  "region_name":region,
  "instance_type_name":instance_type,
  "ssh_key_names":[key],
  "file_system_names":[],
  "quantity":1,
  "name":name,
  "tags":[
    {"key":"jhadina-subsystem","value":"director"},
    {"key":"jhadina-workload","value":"hunyuan-video-1.5"}
  ]
}))
PY
)"

curl --fail-with-body --silent --show-error   --request POST   --url "https://cloud.lambda.ai/api/v1/instance-operations/launch"   --header "accept: application/json"   --header "content-type: application/json"   --header "Authorization: Bearer $LAMBDA_API_KEY"   --data "$payload"

echo
echo "Lambda launch requested. Do not mark Director production-ready until /health returns productionReady=true."
