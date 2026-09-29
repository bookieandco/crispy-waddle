#!/usr/bin/env bash
set -euo pipefail

: "${DIRECTOR_SPEAKER_QC_TOKEN:?Set DIRECTOR_SPEAKER_QC_TOKEN in the worker environment.}"

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
VENV="$ROOT/speaker-qc-venv"
CACHE="$ROOT/models/director-speaker-qc"
DIRECTOR_SOURCE_REF="${DIRECTOR_SOURCE_REF:-main}"

mkdir -p "$ROOT" "$ROOT/models" "$CACHE"

if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$REPO"
fi
cd "$REPO"
git fetch origin "$DIRECTOR_SOURCE_REF"
git checkout "$DIRECTOR_SOURCE_REF"
git pull --ff-only origin "$DIRECTOR_SOURCE_REF"

if ! command -v ffmpeg >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg
fi

python3 -m venv "$VENV"
source "$VENV/bin/activate"
python -m pip install --upgrade pip wheel
python -m pip install -r "$REPO/services/director-speaker-qc/requirements.txt"

export DIRECTOR_SPEAKER_QC_CACHE_DIR="$CACHE"
export DIRECTOR_SPEAKER_QC_MODEL_ID="${DIRECTOR_SPEAKER_QC_MODEL_ID:-speechbrain/spkrec-ecapa-voxceleb}"
export DIRECTOR_SPEAKER_QC_MODEL_REVISION="${DIRECTOR_SPEAKER_QC_MODEL_REVISION:-ff989f88e92ccc120569763824f8eedd5afc9039}"
export DIRECTOR_SPEAKER_QC_DEVICE="${DIRECTOR_SPEAKER_QC_DEVICE:-auto}"

cd "$REPO/services/director-speaker-qc"

echo "Starting Director speaker-QC worker on :8092"
exec uvicorn app:app --host 0.0.0.0 --port 8092
