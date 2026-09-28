#!/usr/bin/env bash
set -euo pipefail

: "${RUNPOD_API_KEY:?RUNPOD_API_KEY is required. Do not store it in Git.}"

if ! command -v runpodctl >/dev/null 2>&1; then
  echo "runpodctl is required. Run scripts/runpod-agent-setup.sh first." >&2
  exit 1
fi

GPU_ID="${RUNPOD_GPU_ID:-NVIDIA GeForce RTX 4090}"
POD_NAME="${RUNPOD_POD_NAME:-jhadina-director-hunyuan}"
IMAGE="${RUNPOD_IMAGE:-runpod/pytorch:1.0.3-cu1281-torch291-ubuntu2404}"
CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-SECURE}"
CUDA_MIN="${RUNPOD_MIN_CUDA_VERSION:-12.4}"
STOP_AFTER="${RUNPOD_STOP_AFTER:-4h}"
TERMINATE_AFTER="${RUNPOD_TERMINATE_AFTER:-8h}"
CONTAINER_GB="${RUNPOD_CONTAINER_DISK_GB:-50}"
EPHEMERAL_VOLUME_GB="${RUNPOD_EPHEMERAL_VOLUME_GB:-150}"
COUNTRY="${RUNPOD_COUNTRY_CODE:-US}"

args=(
  pod create
  --name "$POD_NAME"
  --image "$IMAGE"
  --gpu-id "$GPU_ID"
  --gpu-count 1
  --cloud-type "$CLOUD_TYPE"
  --container-disk-in-gb "$CONTAINER_GB"
  --volume-mount-path /workspace
  --ports "8091/http,22/tcp"
  --min-cuda-version "$CUDA_MIN"
  --ssh true
  --country-code "$COUNTRY"
  --stop-after "$STOP_AFTER"
)

if [[ -n "${RUNPOD_NETWORK_VOLUME_ID:-}" ]]; then
  args+=(--network-volume-id "$RUNPOD_NETWORK_VOLUME_ID")
  echo "Using Runpod network volume: $RUNPOD_NETWORK_VOLUME_ID"
  echo "Automatic termination is disabled so the network-volume deployment can be managed deliberately."
else
  args+=(--volume-in-gb "$EPHEMERAL_VOLUME_GB" --terminate-after "$TERMINATE_AFTER")
  echo "No RUNPOD_NETWORK_VOLUME_ID set."
  echo "Using disposable local volume and terminate-after=$TERMINATE_AFTER to cap forgotten-idle spend."
fi

echo "Creating Director Hunyuan Pod:"
echo "  GPU: $GPU_ID"
echo "  Cloud: $CLOUD_TYPE"
echo "  Auto-stop: $STOP_AFTER"
runpodctl "${args[@]}"

cat <<'EOF'

Next:
  runpodctl pod list
  runpodctl pod get <pod-id>

Then SSH into the Pod and run:
  bash scripts/director-hunyuan-runpod-bootstrap.sh

After the worker starts on port 8091, its HTTPS proxy URL is:
  https://<pod-id>-8091.proxy.runpod.net
EOF
