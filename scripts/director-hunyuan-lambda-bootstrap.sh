#!/usr/bin/env bash
set -euo pipefail

: "${DIRECTOR_HUNYUAN_WORKER_TOKEN:?DIRECTOR_HUNYUAN_WORKER_TOKEN is required}"
: "${DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED:?DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED is required}"
: "${DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED:?DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED is required}"

if [[ "${DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED,,}" != "true" ]]; then
  echo "DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGEMENT_REQUIRED" >&2; exit 1
fi
if [[ "${DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED,,}" != "true" ]]; then
  echo "DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGEMENT_REQUIRED" >&2; exit 1
fi

nvidia-smi
GPU_MB="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n1 | tr -d ' ')"
if [[ "$GPU_MB" -lt 14336 ]]; then
  echo "DIRECTOR_HUNYUAN_GPU_MEMORY_BELOW_14GB:$GPU_MB" >&2; exit 1
fi

ROOT="${JHADINA_GPU_ROOT:-/opt/jhadina}"
sudo mkdir -p "$ROOT" "$ROOT/models" "$ROOT/hunyuan-output"
sudo chown -R "$USER":"$USER" "$ROOT"

if [[ ! -d "$ROOT/HunyuanVideo-1.5/.git" ]]; then
  git clone --depth=1 https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5.git "$ROOT/HunyuanVideo-1.5"
fi

python3 -m venv "$ROOT/hunyuan-venv"
source "$ROOT/hunyuan-venv/bin/activate"
python -m pip install --upgrade pip wheel
python -m pip install -r "$ROOT/HunyuanVideo-1.5/requirements.txt"
python -m pip install fastapi==0.117.1 uvicorn==0.36.0

MODEL_ROOT="$ROOT/models/HunyuanVideo-1.5"
mkdir -p "$MODEL_ROOT/text_encoder" "$MODEL_ROOT/vision_encoder"
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
import json
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

config = model.config
expected = {
    "hidden_size": 1152,
    "intermediate_size": 4304,
    "num_attention_heads": 16,
    "num_hidden_layers": 27,
    "image_size": 384,
    "patch_size": 14,
}
actual = {key: getattr(config, key, None) for key in expected}
if actual != expected:
    raise SystemExit(
        "DIRECTOR_HUNYUAN_SIGLIP_CONFIG_MISMATCH:"
        + json.dumps({"expected": expected, "actual": actual}, sort_keys=True)
    )
processor_height = processor.size.get("height") if isinstance(processor.size, dict) else None
processor_width = processor.size.get("width") if isinstance(processor.size, dict) else None
if (processor_height, processor_width) != (384, 384):
    raise SystemExit(
        f"DIRECTOR_HUNYUAN_SIGLIP_PROCESSOR_MISMATCH:{processor_height}x{processor_width}"
    )

model.save_pretrained(image_encoder, safe_serialization=True)
processor.save_pretrained(feature_extractor)
(root / "SOURCE.json").write_text(
    json.dumps(
        {
            "source": source,
            "revision": revision,
            "license": "apache-2.0",
            "purpose": "HunyuanVideo-1.5 SigLIP vision encoder",
            "expectedConfig": expected,
        },
        sort_keys=True,
        indent=2,
    )
    + "\n"
)

required = (
    image_encoder / "model.safetensors",
    image_encoder / "config.json",
    feature_extractor / "preprocessor_config.json",
    root / "SOURCE.json",
)
missing = [str(path) for path in required if not path.is_file()]
if missing:
    raise SystemExit("DIRECTOR_HUNYUAN_SIGLIP_LAYOUT_INVALID:" + ",".join(missing))
print(f"DIRECTOR_HUNYUAN_SIGLIP_READY:{source}@{revision}")
PY

export HUNYUAN_VIDEO_REPO_DIR="$ROOT/HunyuanVideo-1.5"
export HUNYUAN_VIDEO_MODEL_PATH="$MODEL_ROOT"
export DIRECTOR_HUNYUAN_OUTPUT_DIR="$ROOT/hunyuan-output"
export HUNYUAN_VIDEO_MODEL_VERSION="${HUNYUAN_VIDEO_MODEL_VERSION:-HunyuanVideo-1.5}"

echo "Model tree installed. Start the worker from the crispy-waddle checkout:"
echo "  cd services/director-hunyuan && uvicorn app:app --host 0.0.0.0 --port 8091"
echo "Then verify GET /health reports productionReady=true before connecting Director."
