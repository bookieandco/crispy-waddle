#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=director-hunyuan-source-pins.sh
source "$SCRIPT_DIR/director-hunyuan-source-pins.sh"

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
  git clone --filter=blob:none --no-checkout "$DIRECTOR_HUNYUAN_CODE_SOURCE" "$ROOT/HunyuanVideo-1.5"
fi
git -C "$ROOT/HunyuanVideo-1.5" fetch --depth=1 origin "$DIRECTOR_HUNYUAN_CODE_REVISION"
git -C "$ROOT/HunyuanVideo-1.5" checkout --detach --force "$DIRECTOR_HUNYUAN_CODE_REVISION"
if [[ "$(git -C "$ROOT/HunyuanVideo-1.5" rev-parse HEAD)" != "$DIRECTOR_HUNYUAN_CODE_REVISION" ]]; then
  echo "DIRECTOR_HUNYUAN_CODE_REVISION_MISMATCH" >&2
  exit 1
fi

python3 -m venv "$ROOT/hunyuan-venv"
source "$ROOT/hunyuan-venv/bin/activate"
python -m pip install --upgrade pip wheel
python -m pip install -r "$ROOT/HunyuanVideo-1.5/requirements.txt"
python -m pip install -r "$ROOT/crispy-waddle/services/director-hunyuan/requirements.txt"

MODEL_ROOT="$ROOT/models/HunyuanVideo-1.5"
SOURCE_MANIFEST="$MODEL_ROOT/DIRECTOR_RUNTIME_SOURCES.json"
mkdir -p "$MODEL_ROOT/text_encoder" "$MODEL_ROOT/vision_encoder"

export HUNYUAN_VIDEO_REPO_DIR="$ROOT/HunyuanVideo-1.5"
export HUNYUAN_VIDEO_MODEL_PATH="$MODEL_ROOT"
export DIRECTOR_HUNYUAN_OUTPUT_DIR="$ROOT/hunyuan-output"
export HUNYUAN_VIDEO_MODEL_VERSION="${HUNYUAN_VIDEO_MODEL_VERSION:-HunyuanVideo-1.5@${DIRECTOR_HUNYUAN_MODEL_REVISION}}"

CACHE_READY=false
if [[ -f "$ROOT/HunyuanVideo-1.5/generate.py" \
   && -d "$MODEL_ROOT/transformer" \
   && -d "$MODEL_ROOT/text_encoder/llm" \
   && -d "$MODEL_ROOT/text_encoder/byt5-small" \
   && -f "$MODEL_ROOT/text_encoder/Glyph-SDXL-v2/checkpoints/byt5_model.pt" \
   && -f "$MODEL_ROOT/text_encoder/Glyph-SDXL-v2/checkpoints/byt5_mapper.pt" \
   && -f "$MODEL_ROOT/vision_encoder/siglip/image_encoder/model.safetensors" \
   && -f "$MODEL_ROOT/vision_encoder/siglip/image_encoder/config.json" \
   && -f "$MODEL_ROOT/vision_encoder/siglip/feature_extractor/preprocessor_config.json" \
   && -f "$MODEL_ROOT/vision_encoder/siglip/SOURCE.json" \
   && -f "$SOURCE_MANIFEST" ]]; then
  if SOURCE_MANIFEST="$SOURCE_MANIFEST" \
     DIRECTOR_HUNYUAN_CODE_REVISION="$DIRECTOR_HUNYUAN_CODE_REVISION" \
     DIRECTOR_HUNYUAN_MODEL_REVISION="$DIRECTOR_HUNYUAN_MODEL_REVISION" \
     DIRECTOR_HUNYUAN_QWEN_REVISION="$DIRECTOR_HUNYUAN_QWEN_REVISION" \
     DIRECTOR_HUNYUAN_BYT5_REVISION="$DIRECTOR_HUNYUAN_BYT5_REVISION" \
     DIRECTOR_HUNYUAN_GLYPH_REVISION="$DIRECTOR_HUNYUAN_GLYPH_REVISION" \
     DIRECTOR_HUNYUAN_SIGLIP_REVISION="$DIRECTOR_HUNYUAN_SIGLIP_REVISION" \
     python - <<'PY'
import json, os
from pathlib import Path
manifest=json.loads(Path(os.environ["SOURCE_MANIFEST"]).read_text())
expected={
 "hunyuanCode":os.environ["DIRECTOR_HUNYUAN_CODE_REVISION"],
 "hunyuanWeights":os.environ["DIRECTOR_HUNYUAN_MODEL_REVISION"],
 "qwen":os.environ["DIRECTOR_HUNYUAN_QWEN_REVISION"],
 "byt5":os.environ["DIRECTOR_HUNYUAN_BYT5_REVISION"],
 "glyph":os.environ["DIRECTOR_HUNYUAN_GLYPH_REVISION"],
 "siglip":os.environ["DIRECTOR_HUNYUAN_SIGLIP_REVISION"],
}
actual={key:(manifest.get("sources",{}).get(key,{}) or {}).get("revision") for key in expected}
if actual != expected:
    raise SystemExit("DIRECTOR_HUNYUAN_SOURCE_MANIFEST_MISMATCH")
print("DIRECTOR_HUNYUAN_SOURCE_MANIFEST_MATCH")
PY
  then
    CACHE_READY=true
  fi
fi

if [[ "$CACHE_READY" == "true" ]]; then
  echo "DIRECTOR_HUNYUAN_WARM_CACHE_READY"
else
  if ! command -v hf >/dev/null 2>&1; then
    python -m pip install "huggingface_hub[cli]"
  fi
  echo "DIRECTOR_HUNYUAN_COLD_MODEL_DOWNLOAD"
  hf download "$DIRECTOR_HUNYUAN_MODEL_SOURCE" --revision "$DIRECTOR_HUNYUAN_MODEL_REVISION" --local-dir "$MODEL_ROOT"
  hf download "$DIRECTOR_HUNYUAN_QWEN_SOURCE" --revision "$DIRECTOR_HUNYUAN_QWEN_REVISION" --local-dir "$MODEL_ROOT/text_encoder/llm"
  hf download "$DIRECTOR_HUNYUAN_BYT5_SOURCE" --revision "$DIRECTOR_HUNYUAN_BYT5_REVISION" --local-dir "$MODEL_ROOT/text_encoder/byt5-small"
  hf download "$DIRECTOR_HUNYUAN_GLYPH_SOURCE" --revision "$DIRECTOR_HUNYUAN_GLYPH_REVISION" --local-dir "$MODEL_ROOT/text_encoder/Glyph-SDXL-v2"
  echo "DIRECTOR_HUNYUAN_SIGLIP_OPEN_CHECKPOINT"
  SIGLIP_SOURCE="$DIRECTOR_HUNYUAN_SIGLIP_SOURCE"
  SIGLIP_REVISION="$DIRECTOR_HUNYUAN_SIGLIP_REVISION"
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

  SOURCE_MANIFEST="$SOURCE_MANIFEST" \
  DIRECTOR_HUNYUAN_CODE_SOURCE="$DIRECTOR_HUNYUAN_CODE_SOURCE" \
  DIRECTOR_HUNYUAN_CODE_REVISION="$DIRECTOR_HUNYUAN_CODE_REVISION" \
  DIRECTOR_HUNYUAN_MODEL_SOURCE="$DIRECTOR_HUNYUAN_MODEL_SOURCE" \
  DIRECTOR_HUNYUAN_MODEL_REVISION="$DIRECTOR_HUNYUAN_MODEL_REVISION" \
  DIRECTOR_HUNYUAN_QWEN_SOURCE="$DIRECTOR_HUNYUAN_QWEN_SOURCE" \
  DIRECTOR_HUNYUAN_QWEN_REVISION="$DIRECTOR_HUNYUAN_QWEN_REVISION" \
  DIRECTOR_HUNYUAN_BYT5_SOURCE="$DIRECTOR_HUNYUAN_BYT5_SOURCE" \
  DIRECTOR_HUNYUAN_BYT5_REVISION="$DIRECTOR_HUNYUAN_BYT5_REVISION" \
  DIRECTOR_HUNYUAN_GLYPH_SOURCE="$DIRECTOR_HUNYUAN_GLYPH_SOURCE" \
  DIRECTOR_HUNYUAN_GLYPH_REVISION="$DIRECTOR_HUNYUAN_GLYPH_REVISION" \
  DIRECTOR_HUNYUAN_SIGLIP_SOURCE="$DIRECTOR_HUNYUAN_SIGLIP_SOURCE" \
  DIRECTOR_HUNYUAN_SIGLIP_REVISION="$DIRECTOR_HUNYUAN_SIGLIP_REVISION" \
  python - <<'PY'
import json, os
from pathlib import Path
keys=[
 ("hunyuanCode","DIRECTOR_HUNYUAN_CODE_SOURCE","DIRECTOR_HUNYUAN_CODE_REVISION"),
 ("hunyuanWeights","DIRECTOR_HUNYUAN_MODEL_SOURCE","DIRECTOR_HUNYUAN_MODEL_REVISION"),
 ("qwen","DIRECTOR_HUNYUAN_QWEN_SOURCE","DIRECTOR_HUNYUAN_QWEN_REVISION"),
 ("byt5","DIRECTOR_HUNYUAN_BYT5_SOURCE","DIRECTOR_HUNYUAN_BYT5_REVISION"),
 ("glyph","DIRECTOR_HUNYUAN_GLYPH_SOURCE","DIRECTOR_HUNYUAN_GLYPH_REVISION"),
 ("siglip","DIRECTOR_HUNYUAN_SIGLIP_SOURCE","DIRECTOR_HUNYUAN_SIGLIP_REVISION"),
]
payload={
 "schemaVersion":"DIRECTOR-HUNYUAN-SOURCES-1",
 "sources":{name:{"source":os.environ[src],"revision":os.environ[rev]} for name,src,rev in keys},
 "qualityClaim":False,
 "authority":"SOURCE_PIN_EVIDENCE_ONLY",
}
path=Path(os.environ["SOURCE_MANIFEST"])
path.write_text(json.dumps(payload,sort_keys=True,indent=2)+"\n")
print("DIRECTOR_HUNYUAN_SOURCE_MANIFEST_WRITTEN:"+str(path))
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
