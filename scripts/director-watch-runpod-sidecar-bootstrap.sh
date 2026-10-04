#!/usr/bin/env bash
set -euo pipefail

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
VENV="$ROOT/hunyuan-venv"
MODEL_PATH="${DIRECTOR_WATCH_QWEN_MODEL_PATH:-$ROOT/models/HunyuanVideo-1.5/text_encoder/llm}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "DIRECTOR_WATCH_REPO_REQUIRED:$REPO" >&2
  exit 1
fi
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "DIRECTOR_WATCH_HUNYUAN_VENV_REQUIRED:$VENV" >&2
  exit 1
fi

for attempt in $(seq 1 180); do
  [[ -d "$MODEL_PATH" ]] && break
  if [[ "$attempt" -eq 180 ]]; then
    echo "DIRECTOR_WATCH_QWEN_MODEL_TIMEOUT:$MODEL_PATH" >&2
    exit 1
  fi
  sleep 10
done

source "$VENV/bin/activate"
python -m pip install -r "$REPO/services/director-watch-worker/requirements.txt"

export DIRECTOR_WATCH_VLM_BACKEND="${DIRECTOR_WATCH_VLM_BACKEND:-local-qwen}"
export DIRECTOR_WATCH_QWEN_MODEL_PATH="$MODEL_PATH"
export DIRECTOR_WATCH_SIDECAR_BIND="127.0.0.1"
export DIRECTOR_WATCH_SIDECAR_PORT="${DIRECTOR_WATCH_SIDECAR_PORT:-8094}"
export DIRECTOR_WATCH_SIDECAR_PRODUCTION_READY="${DIRECTOR_WATCH_SIDECAR_PRODUCTION_READY:-true}"

cd "$REPO/services/director-watch-worker"
exec python cloud_server.py
