#!/usr/bin/env bash
set -euo pipefail

PHASE="${JHADINA_VOICE_PHASE:-audition}"
if [[ "$PHASE" != "audition" && "$PHASE" != "production" ]]; then
  echo "JHADINA_VOICE_PHASE_INVALID:$PHASE" >&2
  exit 1
fi

: "${JHADINA_QWEN3_TTS_TOKEN:?Set JHADINA_QWEN3_TTS_TOKEN.}"

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
SOURCE_REF="${JHADINA_SOURCE_REF:-main}"
QWEN_VENV="$ROOT/jhadina-qwen-venv"
VOX_VENV="$ROOT/jhadina-voxcpm-venv"
VOICE_VENV="$ROOT/jhadina-voice-venv"
QC_VENV="$ROOT/jhadina-speaker-qc-venv"
LOG_DIR="$ROOT/logs/jhadina-voice"
RUN_DIR="$ROOT/run/jhadina-voice"
MODEL_ROOT="$ROOT/models/jhadina-voice"
REFERENCE_DIR="$ROOT/voice-reference"

QWEN_PORT="${JHADINA_QWEN3_TTS_PORT:-8093}"
VOX_PORT="${JHADINA_VOXCPM2_TTS_PORT:-8094}"
VOICE_PORT="${JHADINA_VOICE_PORT:-8095}"
QC_PORT="${JHADINA_SPEAKER_QC_PORT:-8096}"

mkdir -p "$ROOT" "$LOG_DIR" "$RUN_DIR" "$MODEL_ROOT" "$REFERENCE_DIR"

if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$REPO"
fi
cd "$REPO"
git fetch origin "$SOURCE_REF"
git checkout "$SOURCE_REF"
git pull --ff-only origin "$SOURCE_REF"

if ! command -v ffmpeg >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ffmpeg libsndfile1
fi

stop_pidfile() {
  local pidfile="$1"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      for _ in $(seq 1 20); do
        kill -0 "$pid" >/dev/null 2>&1 || break
        sleep 1
      done
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pidfile"
  fi
}

start_service() {
  local name="$1"
  local venv="$2"
  local directory="$3"
  local port="$4"
  shift 4
  stop_pidfile "$RUN_DIR/$name.pid"
  (
    set -e
    source "$venv/bin/activate"
    cd "$directory"
    exec env "$@" uvicorn app:app --host 0.0.0.0 --port "$port"
  ) >"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$RUN_DIR/$name.pid"
}

ensure_venv() {
  local venv="$1"
  local requirements="$2"
  if [[ ! -x "$venv/bin/python" ]]; then
    python3 -m venv "$venv"
  fi
  source "$venv/bin/activate"
  python -m pip install --upgrade pip wheel
  python -m pip install -r "$requirements"
  deactivate
}

wait_health() {
  local name="$1"
  local url="$2"
  local expected_field="$3"
  local expected_value="$4"
  for attempt in $(seq 1 180); do
    if curl -fsS "$url" >"/tmp/${name}-health.json" 2>/dev/null; then
      if [[ "$(jq -r ".$expected_field // empty" "/tmp/${name}-health.json")" == "$expected_value" ]]; then
        echo "JHADINA_VOICE_SERVICE_READY:$name"
        return 0
      fi
    fi
    sleep 5
  done
  echo "JHADINA_VOICE_SERVICE_TIMEOUT:$name" >&2
  cat "$LOG_DIR/$name.log" >&2 2>/dev/null || true
  return 1
}

QWEN_MODEL_ID="${JHADINA_QWEN3_TTS_MODEL_ID:-}"
QWEN_VOICE_REF="${JHADINA_QWEN3_TTS_VOICE_REF:-jhadina-qwen-v1}"

ensure_venv "$QWEN_VENV" "$REPO/services/jhadina-tts-provider/requirements-qwen.txt"

if [[ "$PHASE" == "audition" ]]; then
  QWEN_MODEL_ID="${QWEN_MODEL_ID:-Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign}"
  stop_pidfile "$RUN_DIR/voxcpm.pid"
  stop_pidfile "$RUN_DIR/voice-router.pid"
  stop_pidfile "$RUN_DIR/speaker-qc.pid"

  start_service qwen "$QWEN_VENV" "$REPO/services/jhadina-tts-provider" "$QWEN_PORT" \
    JHADINA_TTS_TOKEN="$JHADINA_QWEN3_TTS_TOKEN" \
    JHADINA_TTS_PROVIDER=qwen3-tts \
    JHADINA_TTS_MODE=design \
    JHADINA_TTS_MODEL_ID="$QWEN_MODEL_ID" \
    JHADINA_TTS_VOICE_REF="$QWEN_VOICE_REF" \
    JHADINA_TTS_DEVICE="${JHADINA_TTS_DEVICE:-cuda:0}" \
    HF_HOME="$MODEL_ROOT/huggingface"

  wait_health qwen "http://127.0.0.1:$QWEN_PORT/health" auditionReady true
  echo "JHADINA_VOICE_AUDITION_RUNTIME_READY"
  exit 0
fi

: "${JHADINA_VOXCPM2_TTS_TOKEN:?Set JHADINA_VOXCPM2_TTS_TOKEN.}"
: "${JHADINA_VOICE_TOKEN:?Set JHADINA_VOICE_TOKEN.}"
: "${JHADINA_SPEAKER_QC_TOKEN:?Set JHADINA_SPEAKER_QC_TOKEN.}"
: "${JHADINA_VOICE_APPROVAL_RECEIPT_ID:?Production requires explicit approval receipt.}"
: "${JHADINA_VOICE_APPROVAL_RECEIPT_PATH:?Production requires approval receipt file.}"
: "${JHADINA_VOICE_REFERENCE_PATH:?Production requires approved reference path.}"
: "${JHADINA_VOICE_REFERENCE_SHA256:?Production requires approved reference SHA-256.}"
: "${JHADINA_VOICE_REFERENCE_TEXT:?Production requires reference transcript.}"

if [[ ! -f "$JHADINA_VOICE_REFERENCE_PATH" ]]; then
  echo "JHADINA_VOICE_REFERENCE_NOT_FOUND:$JHADINA_VOICE_REFERENCE_PATH" >&2
  exit 1
fi
ACTUAL_SHA="$(sha256sum "$JHADINA_VOICE_REFERENCE_PATH" | awk '{print $1}')"
if [[ "$ACTUAL_SHA" != "${JHADINA_VOICE_REFERENCE_SHA256,,}" ]]; then
  echo "JHADINA_VOICE_REFERENCE_SHA256_MISMATCH" >&2
  exit 1
fi

QWEN_MODEL_ID="${QWEN_MODEL_ID:-Qwen/Qwen3-TTS-12Hz-1.7B-Base}"
VOX_MODEL_ID="${JHADINA_VOXCPM2_TTS_MODEL_ID:-openbmb/VoxCPM2}"
VOX_VOICE_REF="${JHADINA_VOXCPM2_TTS_VOICE_REF:-jhadina-voxcpm2-v1}"

ensure_venv "$VOX_VENV" "$REPO/services/jhadina-tts-provider/requirements-voxcpm.txt"
ensure_venv "$VOICE_VENV" "$REPO/services/jhadina-voice/requirements.txt"
ensure_venv "$QC_VENV" "$REPO/services/director-speaker-qc/requirements.txt"

start_service qwen "$QWEN_VENV" "$REPO/services/jhadina-tts-provider" "$QWEN_PORT" \
  JHADINA_TTS_TOKEN="$JHADINA_QWEN3_TTS_TOKEN" \
  JHADINA_TTS_PROVIDER=qwen3-tts \
  JHADINA_TTS_MODE=clone \
  JHADINA_TTS_MODEL_ID="$QWEN_MODEL_ID" \
  JHADINA_TTS_VOICE_REF="$QWEN_VOICE_REF" \
  JHADINA_TTS_REFERENCE_PATH="$JHADINA_VOICE_REFERENCE_PATH" \
  JHADINA_TTS_REFERENCE_SHA256="$JHADINA_VOICE_REFERENCE_SHA256" \
  JHADINA_TTS_REFERENCE_TEXT="$JHADINA_VOICE_REFERENCE_TEXT" \
  JHADINA_TTS_DEVICE="${JHADINA_TTS_DEVICE:-cuda:0}" \
  HF_HOME="$MODEL_ROOT/huggingface"

start_service voxcpm "$VOX_VENV" "$REPO/services/jhadina-tts-provider" "$VOX_PORT" \
  JHADINA_TTS_TOKEN="$JHADINA_VOXCPM2_TTS_TOKEN" \
  JHADINA_TTS_PROVIDER=voxcpm2 \
  JHADINA_TTS_MODE=clone \
  JHADINA_TTS_MODEL_ID="$VOX_MODEL_ID" \
  JHADINA_TTS_VOICE_REF="$VOX_VOICE_REF" \
  JHADINA_TTS_REFERENCE_PATH="$JHADINA_VOICE_REFERENCE_PATH" \
  JHADINA_TTS_REFERENCE_SHA256="$JHADINA_VOICE_REFERENCE_SHA256" \
  JHADINA_TTS_REFERENCE_TEXT="$JHADINA_VOICE_REFERENCE_TEXT" \
  JHADINA_TTS_DEVICE="${JHADINA_TTS_DEVICE:-cuda:0}" \
  HF_HOME="$MODEL_ROOT/huggingface"

start_service speaker-qc "$QC_VENV" "$REPO/services/director-speaker-qc" "$QC_PORT" \
  DIRECTOR_SPEAKER_QC_TOKEN="$JHADINA_SPEAKER_QC_TOKEN" \
  DIRECTOR_SPEAKER_QC_CACHE_DIR="$MODEL_ROOT/speaker-qc" \
  DIRECTOR_SPEAKER_QC_MODEL_ID="${JHADINA_SPEAKER_QC_MODEL_ID:-speechbrain/spkrec-ecapa-voxceleb}" \
  DIRECTOR_SPEAKER_QC_MODEL_REVISION="${JHADINA_SPEAKER_QC_MODEL_REVISION:-ff989f88e92ccc120569763824f8eedd5afc9039}" \
  DIRECTOR_SPEAKER_QC_DEVICE="${JHADINA_SPEAKER_QC_DEVICE:-auto}"

start_service voice-router "$VOICE_VENV" "$REPO/services/jhadina-voice" "$VOICE_PORT" \
  JHADINA_VOICE_TOKEN="$JHADINA_VOICE_TOKEN" \
  JHADINA_VOICE_IDENTITY_STATUS=approved \
  JHADINA_VOICE_APPROVAL_RECEIPT_ID="$JHADINA_VOICE_APPROVAL_RECEIPT_ID" \
  JHADINA_VOICE_APPROVAL_RECEIPT_PATH="$JHADINA_VOICE_APPROVAL_RECEIPT_PATH" \
  JHADINA_VOICE_REFERENCE_PATH="$JHADINA_VOICE_REFERENCE_PATH" \
  JHADINA_VOICE_REFERENCE_MIME="${JHADINA_VOICE_REFERENCE_MIME:-audio/wav}" \
  JHADINA_VOICE_REFERENCE_SHA256="$JHADINA_VOICE_REFERENCE_SHA256" \
  JHADINA_VOICE_MIN_SPEAKER_SIMILARITY="${JHADINA_VOICE_MIN_SPEAKER_SIMILARITY:-0.80}" \
  JHADINA_QWEN3_TTS_URL="http://127.0.0.1:$QWEN_PORT/v1/speak" \
  JHADINA_QWEN3_TTS_TOKEN="$JHADINA_QWEN3_TTS_TOKEN" \
  JHADINA_QWEN3_TTS_MODEL_ID="$QWEN_MODEL_ID" \
  JHADINA_QWEN3_TTS_VOICE_REF="$QWEN_VOICE_REF" \
  JHADINA_QWEN3_TTS_LANGUAGES=en-US \
  JHADINA_VOXCPM2_TTS_URL="http://127.0.0.1:$VOX_PORT/v1/speak" \
  JHADINA_VOXCPM2_TTS_TOKEN="$JHADINA_VOXCPM2_TTS_TOKEN" \
  JHADINA_VOXCPM2_TTS_MODEL_ID="$VOX_MODEL_ID" \
  JHADINA_VOXCPM2_TTS_VOICE_REF="$VOX_VOICE_REF" \
  JHADINA_VOXCPM2_TTS_LANGUAGES=en-US \
  JHADINA_SPEAKER_QC_URL="http://127.0.0.1:$QC_PORT" \
  JHADINA_SPEAKER_QC_TOKEN="$JHADINA_SPEAKER_QC_TOKEN"

wait_health qwen "http://127.0.0.1:$QWEN_PORT/health" productionReady true
wait_health voxcpm "http://127.0.0.1:$VOX_PORT/health" productionReady true
wait_health speaker-qc "http://127.0.0.1:$QC_PORT/health" productionReady true
wait_health voice-router "http://127.0.0.1:$VOICE_PORT/health" status ready

echo "JHADINA_VOICE_PRODUCTION_RUNTIME_READY"
