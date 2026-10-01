#!/usr/bin/env bash
set -euo pipefail

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="$ROOT/crispy-waddle"
VENV="$ROOT/hunyuan-venv"
LOG_FILE="$ROOT/hunyuan-worker.log"
PID_FILE="$ROOT/hunyuan-worker.pid"
SOURCE_REF="${DIRECTOR_SOURCE_REF:-main}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "DIRECTOR_RUNPOD_RECONCILE_REPO_REQUIRED:$REPO" >&2
  exit 1
fi
if [[ ! -x "$VENV/bin/python" || ! -x "$VENV/bin/uvicorn" ]]; then
  echo "DIRECTOR_RUNPOD_RECONCILE_HUNYUAN_VENV_REQUIRED:$VENV" >&2
  exit 1
fi

OLD_PID="$(pgrep -f 'uvicorn app:app .*--port 8091|uvicorn app:app --host 0\.0\.0\.0 --port 8091' | head -n1 || true)"
if [[ -z "$OLD_PID" || ! -r "/proc/$OLD_PID/environ" ]]; then
  echo "DIRECTOR_RUNPOD_RECONCILE_RUNNING_HUNYUAN_REQUIRED" >&2
  exit 1
fi

cd "$REPO"
git fetch origin "$SOURCE_REF"
git checkout "$SOURCE_REF"
git pull --ff-only origin "$SOURCE_REF"

"$VENV/bin/python" -m pip install -r "$REPO/services/director-hunyuan/requirements.txt"

OLD_PID="$OLD_PID" \
HUNYUAN_VENV="$VENV" \
HUNYUAN_APP_DIR="$REPO/services/director-hunyuan" \
HUNYUAN_LOG="$LOG_FILE" \
HUNYUAN_PID_FILE="$PID_FILE" \
python3 - <<'PY'
import json
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
    "HUNYUAN_VIDEO_REPO_DIR",
    "HUNYUAN_VIDEO_MODEL_PATH",
    "DIRECTOR_HUNYUAN_OUTPUT_DIR",
)
missing=[key for key in required if not captured.get(key)]
if missing:
    raise SystemExit("DIRECTOR_RUNPOD_RECONCILE_ENV_MISSING:"+",".join(missing))

try:
    os.kill(old_pid,signal.SIGTERM)
except ProcessLookupError:
    pass

deadline=time.time()+20
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
for _ in range(90):
    if child.poll() is not None:
        raise SystemExit(f"DIRECTOR_RUNPOD_RECONCILE_RESTART_FAILED:{child.returncode}")
    try:
        with urllib.request.urlopen("http://127.0.0.1:8091/health",timeout=3) as response:
            body=json.loads(response.read().decode("utf-8"))
            if response.status==200 and body.get("productionReady") is True:
                print(f"DIRECTOR_RUNPOD_RECONCILE_READY:hunyuan_pid={child.pid}")
                raise SystemExit(0)
            last=body.get("status","blocked")
    except Exception as exc:
        last=exc
    time.sleep(1)

raise SystemExit(f"DIRECTOR_RUNPOD_RECONCILE_HEALTH_TIMEOUT:{last}")
PY
