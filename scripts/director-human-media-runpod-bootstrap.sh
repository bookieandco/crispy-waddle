#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=director-human-media-source-pins.sh
source "$SCRIPT_DIR/director-human-media-source-pins.sh"

ROOT="\${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
MUSE_REPO="$ROOT/MuseTalk"
VENV="$ROOT/musetalk-venv"
OUTPUT_DIR="$ROOT/musetalk-output"
PORT="\${DIRECTOR_HUMAN_MEDIA_PORT:-8095}"
RUNTIME_INSTANCE_ID="\${DIRECTOR_HUMAN_MEDIA_RUNTIME_INSTANCE_ID:-runpod:\${RUNPOD_POD_ID:-unknown}:musetalk}"
BASE_IMAGE_REF="\${RUNPOD_IMAGE_REF:-runpod/pytorch:1.0.3-cu1281-torch291-ubuntu2404}"

if pgrep -f "uvicorn app:app .*--port \${PORT}|uvicorn app:app --host 127\\.0\\.0\\.1 --port \${PORT}" >/dev/null 2>&1; then
  echo "DIRECTOR_MUSETALK_SIDECAR_ALREADY_RUNNING"
  exit 0
fi

command -v git >/dev/null 2>&1 || { echo "DIRECTOR_MUSETALK_GIT_REQUIRED" >&2; exit 1; }
command -v nvidia-smi >/dev/null 2>&1 || { echo "DIRECTOR_MUSETALK_NVIDIA_REQUIRED" >&2; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg
  else
    echo "DIRECTOR_MUSETALK_FFMPEG_REQUIRED" >&2
    exit 1
  fi
}

GPU_MB="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n1 | tr -d ' ')"
if [[ -z "$GPU_MB" || "$GPU_MB" -lt 4096 ]]; then
  echo "DIRECTOR_MUSETALK_GPU_MEMORY_BELOW_4GB:\${GPU_MB:-0}" >&2
  exit 1
fi

mkdir -p "$ROOT" "$OUTPUT_DIR"
if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$REPO"
fi
SOURCE_REF="\${DIRECTOR_SOURCE_REF:-main}"
git -C "$REPO" fetch origin "$SOURCE_REF"
git -C "$REPO" checkout "$SOURCE_REF"
git -C "$REPO" pull --ff-only origin "$SOURCE_REF"

if [[ ! -d "$MUSE_REPO/.git" ]]; then
  git clone --filter=blob:none --no-checkout "$DIRECTOR_MUSETALK_CODE_SOURCE" "$MUSE_REPO"
fi
git -C "$MUSE_REPO" fetch --depth=1 origin "$DIRECTOR_MUSETALK_CODE_REVISION"
git -C "$MUSE_REPO" checkout --detach --force "$DIRECTOR_MUSETALK_CODE_REVISION"
if [[ "$(git -C "$MUSE_REPO" rev-parse HEAD)" != "$DIRECTOR_MUSETALK_CODE_REVISION" ]]; then
  echo "DIRECTOR_MUSETALK_CODE_REVISION_MISMATCH" >&2
  exit 1
fi

python3 -m pip install --upgrade uv >/dev/null
python3 -m uv python install 3.10
if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m uv venv --python 3.10 "$VENV"
fi
source "$VENV/bin/activate"
python -m pip install --upgrade pip wheel setuptools
python -m pip install \
  torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 \
  --index-url https://download.pytorch.org/whl/cu118
python -m pip install -r "$MUSE_REPO/requirements.txt"
python -m pip install -U openmim
mim install mmengine
mim install "mmcv==2.0.1"
mim install "mmdet==3.1.0"
mim install "mmpose==1.1.0"
python -m pip install -r "$REPO/services/director-human-media/requirements.txt"

command -v hf >/dev/null 2>&1 || python -m pip install "huggingface_hub[cli]"
command -v gdown >/dev/null 2>&1 || python -m pip install gdown

mkdir -p \
  "$MUSE_REPO/models/musetalkV15" \
  "$MUSE_REPO/models/sd-vae" \
  "$MUSE_REPO/models/whisper" \
  "$MUSE_REPO/models/dwpose" \
  "$MUSE_REPO/models/face-parse-bisent" \
  "$MUSE_REPO/musetalk/utils/face_detection/detection/sfd"

hf download "$DIRECTOR_MUSETALK_MODEL_SOURCE" --revision "$DIRECTOR_MUSETALK_MODEL_REVISION" \
  --include "musetalkV15/musetalk.json" "musetalkV15/unet.pth" \
  --local-dir "$MUSE_REPO/models"

hf download "$DIRECTOR_MUSETALK_VAE_SOURCE" --revision "$DIRECTOR_MUSETALK_VAE_REVISION" \
  --include "config.json" "diffusion_pytorch_model.bin" \
  --local-dir "$MUSE_REPO/models/sd-vae"

hf download "$DIRECTOR_MUSETALK_WHISPER_SOURCE" --revision "$DIRECTOR_MUSETALK_WHISPER_REVISION" \
  --include "config.json" "pytorch_model.bin" "preprocessor_config.json" \
  --local-dir "$MUSE_REPO/models/whisper"

hf download "$DIRECTOR_MUSETALK_DWPOSE_SOURCE" --revision "$DIRECTOR_MUSETALK_DWPOSE_REVISION" \
  --include "dw-ll_ucoco_384.pth" \
  --local-dir "$MUSE_REPO/models/dwpose"

FACE_PARSE="$MUSE_REPO/models/face-parse-bisent/79999_iter.pth"
if [[ ! -s "$FACE_PARSE" ]]; then
  gdown --id "$DIRECTOR_MUSETALK_FACE_PARSE_GDRIVE_ID" -O "$FACE_PARSE"
fi
RESNET18="$MUSE_REPO/models/face-parse-bisent/resnet18-5c106cde.pth"
if [[ ! -s "$RESNET18" ]]; then
  curl -fL "$DIRECTOR_MUSETALK_RESNET18_URL" -o "$RESNET18"
fi
S3FD="$MUSE_REPO/musetalk/utils/face_detection/detection/sfd/s3fd.pth"
if [[ ! -s "$S3FD" ]]; then
  curl -fL "$DIRECTOR_MUSETALK_S3FD_URL" -o "$S3FD"
fi

MANIFEST="$MUSE_REPO/DIRECTOR_RUNTIME_SOURCES.json"
MUSE_REPO="$MUSE_REPO" \
MANIFEST="$MANIFEST" \
DIRECTOR_MUSETALK_CODE_SOURCE="$DIRECTOR_MUSETALK_CODE_SOURCE" \
DIRECTOR_MUSETALK_CODE_REVISION="$DIRECTOR_MUSETALK_CODE_REVISION" \
DIRECTOR_MUSETALK_MODEL_SOURCE="$DIRECTOR_MUSETALK_MODEL_SOURCE" \
DIRECTOR_MUSETALK_MODEL_REVISION="$DIRECTOR_MUSETALK_MODEL_REVISION" \
DIRECTOR_MUSETALK_VAE_SOURCE="$DIRECTOR_MUSETALK_VAE_SOURCE" \
DIRECTOR_MUSETALK_VAE_REVISION="$DIRECTOR_MUSETALK_VAE_REVISION" \
DIRECTOR_MUSETALK_WHISPER_SOURCE="$DIRECTOR_MUSETALK_WHISPER_SOURCE" \
DIRECTOR_MUSETALK_WHISPER_REVISION="$DIRECTOR_MUSETALK_WHISPER_REVISION" \
DIRECTOR_MUSETALK_DWPOSE_SOURCE="$DIRECTOR_MUSETALK_DWPOSE_SOURCE" \
DIRECTOR_MUSETALK_DWPOSE_REVISION="$DIRECTOR_MUSETALK_DWPOSE_REVISION" \
DIRECTOR_MUSETALK_FACE_PARSE_GDRIVE_ID="$DIRECTOR_MUSETALK_FACE_PARSE_GDRIVE_ID" \
DIRECTOR_MUSETALK_RESNET18_URL="$DIRECTOR_MUSETALK_RESNET18_URL" \
DIRECTOR_MUSETALK_S3FD_URL="$DIRECTOR_MUSETALK_S3FD_URL" \
python - <<'PY'
import hashlib
import json
import os
from pathlib import Path

root=Path(os.environ["MUSE_REPO"])
def digest(path:str)->str:
    h=hashlib.sha256()
    with (root/path).open("rb") as handle:
        for chunk in iter(lambda:handle.read(8*1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

artifacts=[
    ("musetalk-v15-unet","models/musetalkV15/unet.pth",["license:TMElyralab/MuseTalk:model-commercial"]),
    ("musetalk-v15-config","models/musetalkV15/musetalk.json",["license:TMElyralab/MuseTalk:MIT"]),
    ("sd-vae-ft-mse","models/sd-vae/diffusion_pytorch_model.bin",["license:stabilityai/sd-vae-ft-mse:MIT"]),
    ("sd-vae-config","models/sd-vae/config.json",["license:stabilityai/sd-vae-ft-mse:MIT"]),
    ("whisper-tiny","models/whisper/pytorch_model.bin",["license:openai/whisper-tiny:Apache-2.0"]),
    ("whisper-config","models/whisper/config.json",["license:openai/whisper-tiny:Apache-2.0"]),
    ("whisper-preprocessor","models/whisper/preprocessor_config.json",["license:openai/whisper-tiny:Apache-2.0"]),
    ("dwpose-384","models/dwpose/dw-ll_ucoco_384.pth",["license:yzd-v/DWPose:Apache-2.0"]),
    ("face-parse-bisenet","models/face-parse-bisent/79999_iter.pth",["license:zllrunning/face-parsing.PyTorch:MIT"]),
    ("resnet18","models/face-parse-bisent/resnet18-5c106cde.pth",["license:pytorch/vision:BSD-3-Clause"]),
    ("s3fd","musetalk/utils/face_detection/detection/sfd/s3fd.pth",["license:yxlijun/S3FD.pytorch:upstream-evidence-required"]),
]
payload={
    "schemaVersion":"DIRECTOR-HUMAN-MEDIA-MUSETALK-SOURCES-1",
    "sourceRepository":os.environ["DIRECTOR_MUSETALK_CODE_SOURCE"],
    "sourceRevision":os.environ["DIRECTOR_MUSETALK_CODE_REVISION"],
    "sources":{
        "musetalkModel":{"source":os.environ["DIRECTOR_MUSETALK_MODEL_SOURCE"],"revision":os.environ["DIRECTOR_MUSETALK_MODEL_REVISION"]},
        "vae":{"source":os.environ["DIRECTOR_MUSETALK_VAE_SOURCE"],"revision":os.environ["DIRECTOR_MUSETALK_VAE_REVISION"]},
        "whisper":{"source":os.environ["DIRECTOR_MUSETALK_WHISPER_SOURCE"],"revision":os.environ["DIRECTOR_MUSETALK_WHISPER_REVISION"]},
        "dwpose":{"source":os.environ["DIRECTOR_MUSETALK_DWPOSE_SOURCE"],"revision":os.environ["DIRECTOR_MUSETALK_DWPOSE_REVISION"]},
        "faceParse":{"source":"gdrive:"+os.environ["DIRECTOR_MUSETALK_FACE_PARSE_GDRIVE_ID"]},
        "resnet18":{"source":os.environ["DIRECTOR_MUSETALK_RESNET18_URL"]},
        "s3fd":{"source":os.environ["DIRECTOR_MUSETALK_S3FD_URL"]},
    },
    "modelArtifacts":[
        {"id":artifact_id,"path":path,"sha256":digest(path),"licenseEvidenceIds":licenses}
        for artifact_id,path,licenses in artifacts
    ],
    "qualityClaim":False,
    "authority":"SOURCE_PIN_EVIDENCE_ONLY",
}
Path(os.environ["MANIFEST"]).write_text(json.dumps(payload,sort_keys=True,indent=2)+"\n")
print("DIRECTOR_MUSETALK_SOURCE_MANIFEST_WRITTEN")
PY

PIP_FREEZE_SHA="$("$VENV/bin/python" -m pip freeze | sha256sum | awk '{print $1}')"
MANIFEST_SHA="$(sha256sum "$MANIFEST" | awk '{print $1}')"
SERVICE_SHA="$(sha256sum "$REPO/services/director-human-media/worker.py" "$REPO/services/director-human-media/app.py" | sha256sum | awk '{print $1}')"
RUNTIME_DIGEST="$(printf '%s\n' "$BASE_IMAGE_REF" "$DIRECTOR_MUSETALK_CODE_REVISION" "$MANIFEST_SHA" "$PIP_FREEZE_SHA" "$SERVICE_SHA" | sha256sum | awk '{print $1}')"

export DIRECTOR_MUSETALK_REPO_DIR="$MUSE_REPO"
export DIRECTOR_MUSETALK_OUTPUT_DIR="$OUTPUT_DIR"
export DIRECTOR_MUSETALK_SOURCE_REVISION="$DIRECTOR_MUSETALK_CODE_REVISION"
export DIRECTOR_MUSETALK_SOURCE_MANIFEST="$MANIFEST"
export DIRECTOR_HUMAN_MEDIA_RUNTIME_INSTANCE_ID="$RUNTIME_INSTANCE_ID"
export DIRECTOR_HUMAN_MEDIA_IMAGE_DIGEST="$RUNTIME_DIGEST"
export PYTHONUNBUFFERED=1

cd "$REPO/services/director-human-media"
echo "DIRECTOR_MUSETALK_START:port=$PORT:runtime_fingerprint=$RUNTIME_DIGEST"
exec "$VENV/bin/uvicorn" app:app --host 127.0.0.1 --port 8095
