#!/usr/bin/env bash
set -euo pipefail

: "${RUNPOD_API_KEY:?RUNPOD_API_KEY is required. Do not store it in Git.}"

if ! command -v runpodctl >/dev/null 2>&1; then
  echo "runpodctl is required. Run scripts/runpod-agent-setup.sh first." >&2
  exit 1
fi

GPU_ID="${RUNPOD_GPU_ID:-AUTO}"
MAX_HOURLY_USD="${RUNPOD_MAX_HOURLY_USD:-1.00}"
MIN_GPU_MEMORY_GB="${RUNPOD_MIN_GPU_MEMORY_GB:-24}"
POD_NAME="${RUNPOD_POD_NAME:-jhadina-director-hunyuan}"
IMAGE="${RUNPOD_IMAGE:-runpod/pytorch:1.0.3-cu1281-torch291-ubuntu2404}"
CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-SECURE}"
CUDA_MIN="${RUNPOD_MIN_CUDA_VERSION:-12.4}"
STOP_AFTER="${RUNPOD_STOP_AFTER:-4h}"
TERMINATE_AFTER="${RUNPOD_TERMINATE_AFTER:-8h}"
CONTAINER_GB="${RUNPOD_CONTAINER_DISK_GB:-50}"
EPHEMERAL_VOLUME_GB="${RUNPOD_EPHEMERAL_VOLUME_GB:-150}"
COUNTRY="${RUNPOD_COUNTRY_CODE:-US}"

if [[ "$GPU_ID" == "AUTO" ]]; then
  command -v jq >/dev/null 2>&1 || {
    echo "jq is required for automatic Runpod GPU selection." >&2
    exit 1
  }

  inventory="$(mktemp)"
  trap 'rm -f "$inventory"' EXIT
  runpodctl gpu list >"$inventory"

  valid_gpu() {
    local id="$1"
    jq -ce \
      --arg id "$id" \
      --arg country "$COUNTRY-" \
      --argjson max "$MAX_HOURLY_USD" \
      --argjson min "$MIN_GPU_MEMORY_GB" \
      '[.[]
        | select(.gpuId == $id)
        | select(.available == true)
        | select(.secureCloud == true)
        | select((.memoryInGb // 0) >= $min)
        | select((.securePricePerHr // 999999) <= $max)
        | select(any(.dataCenterAvailability[]?;
            (.dataCenterId | startswith($country)) and (.stockStatus != "none")))
      ] | first // empty' "$inventory"
  }

  selected=""
  preferred=(
    "NVIDIA RTX A6000"
    "NVIDIA L40"
    "NVIDIA RTX 6000 Ada Generation"
    "NVIDIA RTX PRO 4500 Blackwell Server Edition"
    "NVIDIA L4"
  )
  for id in "${preferred[@]}"; do
    selected="$(valid_gpu "$id" || true)"
    [[ -n "$selected" ]] && break
  done

  if [[ -z "$selected" ]]; then
    selected="$(jq -ce \
      --arg country "$COUNTRY-" \
      --argjson max "$MAX_HOURLY_USD" \
      --argjson min "$MIN_GPU_MEMORY_GB" \
      '[.[]
        | select(.available == true)
        | select(.secureCloud == true)
        | select((.memoryInGb // 0) >= $min)
        | select((.securePricePerHr // 999999) <= $max)
        | select(any(.dataCenterAvailability[]?;
            (.dataCenterId | startswith($country)) and (.stockStatus != "none")))
      ]
      | sort_by([.securePricePerHr, -(.memoryInGb // 0)])
      | first // empty' "$inventory" || true)"
  fi

  if [[ -z "$selected" ]]; then
    echo "No Secure Cloud GPU is currently available in $COUNTRY with >=${MIN_GPU_MEMORY_GB} GB VRAM under ${MAX_HOURLY_USD}/hr." >&2
    exit 1
  fi

  GPU_ID="$(printf '%s' "$selected" | jq -r '.gpuId')"
  GPU_PRICE="$(printf '%s' "$selected" | jq -r '.securePricePerHr')"
  GPU_MEMORY="$(printf '%s' "$selected" | jq -r '.memoryInGb')"
  echo "Auto-selected GPU: $GPU_ID (${GPU_MEMORY} GB, Secure ${GPU_PRICE}/hr)"
fi

args=(
  pod create
  --name "$POD_NAME"
  --image "$IMAGE"
  --gpu-id "$GPU_ID"
  --gpu-count 1
  --cloud-type "$CLOUD_TYPE"
  --container-disk-in-gb "$CONTAINER_GB"
  --volume-mount-path /workspace
  --ports "8091/http,8092/http,22/tcp"
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
if [[ "${RUNPOD_GPU_ID:-AUTO}" == "AUTO" ]]; then
  echo "  Auto-selection ceiling: ${MAX_HOURLY_USD}/hr"
fi
echo "  Auto-stop: $STOP_AFTER"
runpodctl "${args[@]}"

cat <<'EOF'

Next:
  runpodctl pod list
  runpodctl pod get <pod-id>

Then SSH into the Pod and run:
  bash scripts/director-hunyuan-runpod-bootstrap.sh

After the Hunyuan worker starts on port 8091, its HTTPS proxy URL is:
  https://<pod-id>-8091.proxy.runpod.net

The same Pod can host the separate speaker-QC service:
  bash scripts/director-speaker-qc-runpod-bootstrap.sh

Speaker-QC then uses:
  https://<pod-id>-8092.proxy.runpod.net

Music restoration is started automatically as a localhost sidecar by the
Hunyuan bootstrap and is proxied through the existing 8091 HTTPS endpoint:
  https://<pod-id>-8091.proxy.runpod.net/music-restoration
EOF
