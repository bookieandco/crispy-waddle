#!/usr/bin/env bash
set -euo pipefail

: "${DIRECTOR_HUNYUAN_WORKER_TOKEN:?Set DIRECTOR_HUNYUAN_WORKER_TOKEN in the SSH session.}"
: "${HF_TOKEN:?Set HF_TOKEN in the SSH session for gated Hugging Face dependencies.}"
: "${DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED:?Set DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true after reviewing the Hunyuan license.}"
: "${DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED:?Set DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true after reviewing territory restrictions.}"

if [[ "${DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED,,}" != "true" ]]; then
  echo "DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGEMENT_REQUIRED" >&2
  exit 1
fi
if [[ "${DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED,,}" != "true" ]]; then
  echo "DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGEMENT_REQUIRED" >&2
  exit 1
fi

nvidia-smi
GPU_MB="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n1 | tr -d ' ')"
if [[ "$GPU_MB" -lt 14336 ]]; then
  echo "DIRECTOR_HUNYUAN_GPU_MEMORY_BELOW_14GB:$GPU_MB" >&2
  exit 1
fi

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
mkdir -p "$ROOT" "$ROOT/models" "$ROOT/hunyuan-output"

if [[ ! -d "$ROOT/crispy-waddle/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$ROOT/crispy-waddle"
fi
cd "$ROOT/crispy-waddle"
git fetch origin
git checkout feat/director-hunyuan-video-15-20260928
git pull --ff-only origin feat/director-hunyuan-video-15-20260928

if [[ ! -d "$ROOT/HunyuanVideo-1.5/.git" ]]; then
  git clone --depth=1 https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5.git "$ROOT/HunyuanVideo-1.5"
fi

python3 -m venv "$ROOT/hunyuan-venv"
source "$ROOT/hunyuan-venv/bin/activate"
python -m pip install --upgrade pip wheel
python -m pip install -r "$ROOT/HunyuanVideo-1.5/requirements.txt"
python -m pip install -r "$ROOT/crispy-waddle/services/director-hunyuan/requirements.txt"

MODEL_ROOT="$ROOT/models/HunyuanVideo-1.5"
mkdir -p "$MODEL_ROOT/text_encoder" "$MODEL_ROOT/vision_encoder"

if ! command -v hf >/dev/null 2>&1; then
  python -m pip install "huggingface_hub[cli]"
fi
if ! command -v modelscope >/dev/null 2>&1; then
  python -m pip install modelscope
fi

hf download tencent/HunyuanVideo-1.5 --local-dir "$MODEL_ROOT"
hf download Qwen/Qwen2.5-VL-7B-Instruct --local-dir "$MODEL_ROOT/text_encoder/llm"
hf download google/byt5-small --local-dir "$MODEL_ROOT/text_encoder/byt5-small"
modelscope download --model AI-ModelScope/Glyph-SDXL-v2 --local_dir "$MODEL_ROOT/text_encoder/Glyph-SDXL-v2"
hf download black-forest-labs/FLUX.1-Redux-dev   --local-dir "$MODEL_ROOT/vision_encoder/siglip"   --token "$HF_TOKEN"

export HUNYUAN_VIDEO_REPO_DIR="$ROOT/HunyuanVideo-1.5"
export HUNYUAN_VIDEO_MODEL_PATH="$MODEL_ROOT"
export DIRECTOR_HUNYUAN_OUTPUT_DIR="$ROOT/hunyuan-output"
export HUNYUAN_VIDEO_MODEL_VERSION="${HUNYUAN_VIDEO_MODEL_VERSION:-HunyuanVideo-1.5}"

cd "$ROOT/crispy-waddle/services/director-hunyuan"

echo "Starting Director Hunyuan worker on :8091"
exec uvicorn app:app --host 0.0.0.0 --port 8091
