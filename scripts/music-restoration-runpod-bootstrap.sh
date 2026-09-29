#!/usr/bin/env bash
set -euo pipefail

: "${MUSIC_RESTORATION_WORKER_TOKEN:?Set MUSIC_RESTORATION_WORKER_TOKEN in the worker environment.}"

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
VENV="$ROOT/music-restoration-venv"
OUTPUT="$ROOT/music-restoration-output"
TORCH_CACHE="$ROOT/models/torch"
SOURCE_REF="${DIRECTOR_SOURCE_REF:-main}"

mkdir -p "$ROOT" "$ROOT/models" "$OUTPUT" "$TORCH_CACHE"

if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$REPO"
fi
cd "$REPO"
git fetch origin "$SOURCE_REF"
git checkout "$SOURCE_REF"
git pull --ff-only origin "$SOURCE_REF"

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg libsndfile1
  else
    echo "MUSIC_RESTORATION_FFMPEG_REQUIRED" >&2
    exit 1
  fi
fi

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "MUSIC_RESTORATION_NVIDIA_RUNTIME_REQUIRED" >&2
  exit 1
fi
nvidia-smi

if [[ ! -d "$VENV" ]]; then
  python3 -m venv --system-site-packages "$VENV"
fi
source "$VENV/bin/activate"
python -m pip install --upgrade pip wheel
python -m pip install -r "$REPO/services/music-restoration-worker/requirements.txt"

export MUSIC_RESTORATION_OUTPUT_DIR="$OUTPUT"
export MUSIC_RESTORATION_DEMUCS_MODEL="${MUSIC_RESTORATION_DEMUCS_MODEL:-htdemucs}"
export MUSIC_RESTORATION_DEMUCS_DEVICE="${MUSIC_RESTORATION_DEMUCS_DEVICE:-cuda}"
export MUSIC_RESTORATION_SOURCE_HOST_SUFFIXES="${MUSIC_RESTORATION_SOURCE_HOST_SUFFIXES:-.supabase.co}"
export TORCH_HOME="$TORCH_CACHE"

python - <<'PY'
import os
import torch
from demucs.pretrained import get_model

device=os.environ.get("MUSIC_RESTORATION_DEMUCS_DEVICE","cuda")
if device=="cuda" and not torch.cuda.is_available():
    raise SystemExit("MUSIC_RESTORATION_CUDA_REQUIRED")
model_id=os.environ.get("MUSIC_RESTORATION_DEMUCS_MODEL","htdemucs")
get_model(model_id)
print(f"MUSIC_RESTORATION_MODEL_READY:{model_id}:device={device}:cuda={torch.cuda.is_available()}")
PY

cd "$REPO/services/music-restoration-worker"

echo "Starting Music restoration worker on :8093"
exec uvicorn app:app --host 0.0.0.0 --port 8093
