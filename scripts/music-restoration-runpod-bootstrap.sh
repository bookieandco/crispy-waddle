#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-foreground}"
ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
VENV="$ROOT/music-restoration-venv"
OUTPUT="$ROOT/music-restoration-output"
TORCH_CACHE="$ROOT/models/torch"
PID_FILE="$ROOT/music-restoration-worker.pid"
LOG_FILE="$ROOT/music-restoration-worker.log"
SOURCE_REF="${DIRECTOR_SOURCE_REF:-main}"
BIND_HOST="${MUSIC_RESTORATION_BIND_HOST:-127.0.0.1}"
PORT="${MUSIC_RESTORATION_PORT:-8093}"

if [[ "$MODE" != "foreground" && "$MODE" != "--background" ]]; then
  echo "Usage: $0 [--background]" >&2
  exit 2
fi

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

if [[ "$MODE" == "--background" ]]; then
  if [[ -f "$PID_FILE" ]]; then
    OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
      echo "Music restoration sidecar already running as PID $OLD_PID"
      exit 0
    fi
  fi

  echo "Starting Music restoration sidecar on $BIND_HOST:$PORT"
  nohup "$VENV/bin/uvicorn" app:app --host "$BIND_HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
  PID="$!"
  echo "$PID" > "$PID_FILE"

  MUSIC_RESTORATION_HEALTH_URL="http://127.0.0.1:$PORT/health/live" python - <<'PY'
import os
import time
import urllib.request

url=os.environ["MUSIC_RESTORATION_HEALTH_URL"]
last=None
for _ in range(45):
    try:
        with urllib.request.urlopen(url,timeout=2) as response:
            if response.status==200:
                print("MUSIC_RESTORATION_SIDECAR_READY")
                raise SystemExit(0)
    except Exception as exc:
        last=exc
    time.sleep(1)
raise SystemExit(f"MUSIC_RESTORATION_SIDECAR_START_FAILED:{last}")
PY
  exit 0
fi

echo "Starting Music restoration worker on $BIND_HOST:$PORT"
exec uvicorn app:app --host "$BIND_HOST" --port "$PORT"
