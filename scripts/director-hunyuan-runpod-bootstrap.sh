#!/usr/bin/env bash
set -euo pipefail

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

if ! command -v ffprobe >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg
  else
    echo "DIRECTOR_HUNYUAN_FFPROBE_REQUIRED" >&2
    exit 1
  fi
fi

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
mkdir -p "$ROOT" "$ROOT/models" "$ROOT/hunyuan-output"

if [[ ! -d "$ROOT/crispy-waddle/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$ROOT/crispy-waddle"
fi
cd "$ROOT/crispy-waddle"
DIRECTOR_SOURCE_REF="${DIRECTOR_SOURCE_REF:-main}"
git fetch origin "$DIRECTOR_SOURCE_REF"
git checkout "$DIRECTOR_SOURCE_REF"
git pull --ff-only origin "$DIRECTOR_SOURCE_REF"

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

export HUNYUAN_VIDEO_REPO_DIR="$ROOT/HunyuanVideo-1.5"
export HUNYUAN_VIDEO_MODEL_PATH="$MODEL_ROOT"
export DIRECTOR_HUNYUAN_OUTPUT_DIR="$ROOT/hunyuan-output"
export HUNYUAN_VIDEO_MODEL_VERSION="${HUNYUAN_VIDEO_MODEL_VERSION:-HunyuanVideo-1.5}"

CACHE_READY=false
if [[ -f "$ROOT/HunyuanVideo-1.5/generate.py" \
   && -d "$MODEL_ROOT/transformer" \
   && -d "$MODEL_ROOT/text_encoder/llm" \
   && -d "$MODEL_ROOT/text_encoder/byt5-small" \
   && -d "$MODEL_ROOT/text_encoder/Glyph-SDXL-v2" \
   && -d "$MODEL_ROOT/vision_encoder/siglip/image_encoder" \
   && -d "$MODEL_ROOT/vision_encoder/siglip/feature_extractor" ]]; then
  CACHE_READY=true
fi

if [[ "$CACHE_READY" == "true" ]]; then
  echo "DIRECTOR_HUNYUAN_WARM_CACHE_READY"
else
  if ! command -v hf >/dev/null 2>&1; then
    python -m pip install "huggingface_hub[cli]"
  fi
  if ! command -v modelscope >/dev/null 2>&1; then
    python -m pip install modelscope
  fi

  echo "DIRECTOR_HUNYUAN_COLD_MODEL_DOWNLOAD"
  hf download tencent/HunyuanVideo-1.5 --local-dir "$MODEL_ROOT"
  hf download Qwen/Qwen2.5-VL-7B-Instruct --local-dir "$MODEL_ROOT/text_encoder/llm"
  hf download google/byt5-small --local-dir "$MODEL_ROOT/text_encoder/byt5-small"
  modelscope download --model AI-ModelScope/Glyph-SDXL-v2 --local_dir "$MODEL_ROOT/text_encoder/Glyph-SDXL-v2"
  echo "DIRECTOR_HUNYUAN_SIGLIP_OPEN_CHECKPOINT"
  SIGLIP_SOURCE="google/siglip-so400m-patch14-384"
  SIGLIP_REVISION="538da78b54e0d958422c4b1d5562a21595f4adce"
  SIGLIP_ROOT="$MODEL_ROOT/vision_encoder/siglip"
  mkdir -p "$SIGLIP_ROOT/image_encoder" "$SIGLIP_ROOT/feature_extractor"
  SIGLIP_SOURCE="$SIGLIP_SOURCE" SIGLIP_REVISION="$SIGLIP_REVISION" SIGLIP_ROOT="$SIGLIP_ROOT" python - <<'PY'
import os
from pathlib import Path
from transformers import SiglipImageProcessor, SiglipVisionModel

source = os.environ["SIGLIP_SOURCE"]
revision = os.environ["SIGLIP_REVISION"]
root = Path(os.environ["SIGLIP_ROOT"])
image_encoder = root / "image_encoder"
feature_extractor = root / "feature_extractor"

model = SiglipVisionModel.from_pretrained(source, revision=revision)
processor = SiglipImageProcessor.from_pretrained(source, revision=revision)
model.save_pretrained(image_encoder, safe_serialization=True)
processor.save_pretrained(feature_extractor)

required = (
    image_encoder / "config.json",
    feature_extractor / "preprocessor_config.json",
)
missing = [str(path) for path in required if not path.is_file()]
if missing:
    raise SystemExit("DIRECTOR_HUNYUAN_SIGLIP_LAYOUT_INVALID:" + ",".join(missing))
print(f"DIRECTOR_HUNYUAN_SIGLIP_READY:{source}@{revision}")
PY
fi

echo "Bootstrapping localhost Music restoration sidecar"
DIRECTOR_SOURCE_REF="$DIRECTOR_SOURCE_REF" \
MUSIC_RESTORATION_WORKER_TOKEN="${MUSIC_RESTORATION_WORKER_TOKEN:-${DIRECTOR_HUNYUAN_WORKER_TOKEN:-}}" \
MUSIC_RESTORATION_BIND_HOST=127.0.0.1 \
MUSIC_RESTORATION_PORT=8093 \
bash "$ROOT/crispy-waddle/scripts/music-restoration-runpod-bootstrap.sh" --background

cd "$ROOT/crispy-waddle/services/director-hunyuan"

echo "Starting Director Hunyuan worker on :8091"
exec uvicorn app:app --host 0.0.0.0 --port 8091
