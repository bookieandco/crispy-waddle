#!/usr/bin/env bash
set -euo pipefail

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
HUNYUAN_VENV="$ROOT/hunyuan-venv"
HUNYUAN_LOG="$ROOT/hunyuan-worker.log"
HUNYUAN_PID_FILE="$ROOT/hunyuan-worker.pid"
SOURCE_REF="${DIRECTOR_SOURCE_REF:-main}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "MUSIC_RESTORATION_COMMISSION_REPO_REQUIRED:$REPO" >&2
  exit 1
fi
if [[ ! -x "$HUNYUAN_VENV/bin/python" || ! -x "$HUNYUAN_VENV/bin/uvicorn" ]]; then
  echo "MUSIC_RESTORATION_COMMISSION_HUNYUAN_VENV_REQUIRED:$HUNYUAN_VENV" >&2
  exit 1
fi

OLD_PID="$(pgrep -f 'uvicorn app:app .*--port 8091|uvicorn app:app --host 0\.0\.0\.0 --port 8091' | head -n1 || true)"
if [[ -z "$OLD_PID" || ! -r "/proc/$OLD_PID/environ" ]]; then
  echo "MUSIC_RESTORATION_COMMISSION_RUNNING_HUNYUAN_REQUIRED" >&2
  exit 1
fi

echo "Commissioning Music restoration beside Hunyuan PID $OLD_PID"

HUNYUAN_WORKER_TOKEN=""
while IFS='=' read -r -d '' key value; do
  if [[ "$key" == "DIRECTOR_HUNYUAN_WORKER_TOKEN" ]]; then
    HUNYUAN_WORKER_TOKEN="$value"
    break
  fi
done < "/proc/$OLD_PID/environ"
if [[ -z "$HUNYUAN_WORKER_TOKEN" ]]; then
  echo "MUSIC_RESTORATION_COMMISSION_HUNYUAN_TOKEN_REQUIRED" >&2
  exit 1
fi

cd "$REPO"
git fetch origin "$SOURCE_REF"
git checkout "$SOURCE_REF"
git pull --ff-only origin "$SOURCE_REF"

"$HUNYUAN_VENV/bin/python" -m pip install -r "$REPO/services/director-hunyuan/requirements.txt"

DIRECTOR_SOURCE_REF="$SOURCE_REF" \
MUSIC_RESTORATION_WORKER_TOKEN="$HUNYUAN_WORKER_TOKEN" \
MUSIC_RESTORATION_BIND_HOST=127.0.0.1 \
MUSIC_RESTORATION_PORT=8093 \
bash "$REPO/scripts/music-restoration-runpod-bootstrap.sh" --background
unset HUNYUAN_WORKER_TOKEN

OLD_PID="$OLD_PID" \
HUNYUAN_VENV="$HUNYUAN_VENV" \
HUNYUAN_APP_DIR="$REPO/services/director-hunyuan" \
HUNYUAN_LOG="$HUNYUAN_LOG" \
HUNYUAN_PID_FILE="$HUNYUAN_PID_FILE" \
python3 - <<'PY'
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

old_pid=int(os.environ["OLD_PID"])
env_path=Path(f"/proc/{old_pid}/environ")
raw=env_path.read_bytes()
captured={}
for item in raw.split(b"\0"):
    if not item or b"=" not in item:
        continue
    key,value=item.split(b"=",1)
    captured[key.decode(errors="strict")]=value.decode(errors="surrogateescape")

required=(
    "DIRECTOR_HUNYUAN_WORKER_TOKEN",
    "HUNYUAN_VIDEO_REPO_DIR",
    "HUNYUAN_VIDEO_MODEL_PATH",
    "DIRECTOR_HUNYUAN_OUTPUT_DIR",
)
missing=[key for key in required if not captured.get(key)]
if missing:
    raise SystemExit("MUSIC_RESTORATION_COMMISSION_HUNYUAN_ENV_MISSING:"+",".join(missing))

try:
    os.kill(old_pid,signal.SIGTERM)
except ProcessLookupError:
    pass
deadline=time.time()+15
while time.time()<deadline:
    try:
        os.kill(old_pid,0)
    except ProcessLookupError:
        break
    time.sleep(0.5)
else:
    try:
        os.kill(old_pid,signal.SIGKILL)
    except ProcessLookupError:
        pass

venv=Path(os.environ["HUNYUAN_VENV"])
app_dir=Path(os.environ["HUNYUAN_APP_DIR"])
log_path=Path(os.environ["HUNYUAN_LOG"])
pid_file=Path(os.environ["HUNYUAN_PID_FILE"])
captured["PYTHONUNBUFFERED"]="1"

with log_path.open("ab",buffering=0) as log:
    child=subprocess.Popen(
        [str(venv/"bin/uvicorn"),"app:app","--host","0.0.0.0","--port","8091"],
        cwd=str(app_dir),
        env=captured,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )
pid_file.write_text(str(child.pid))

last=None
for _ in range(60):
    if child.poll() is not None:
        raise SystemExit(f"MUSIC_RESTORATION_COMMISSION_HUNYUAN_RESTART_FAILED:{child.returncode}")
    try:
        with urllib.request.urlopen("http://127.0.0.1:8091/health/live",timeout=2) as response:
            if response.status==200:
                print(f"MUSIC_RESTORATION_COMMISSION_READY:hunyuan_pid={child.pid}")
                raise SystemExit(0)
    except Exception as exc:
        last=exc
    time.sleep(1)

raise SystemExit(f"MUSIC_RESTORATION_COMMISSION_HEALTH_TIMEOUT:{last}")
PY
