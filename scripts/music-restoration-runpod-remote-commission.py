#!/usr/bin/env python3
"""Commission the canonical Jhadina GPU pod from an authenticated SSH session.

This script intentionally receives no RunPod or Vercel secret. The caller
establishes SSH; the pod's own environment supplies only the provider/model
credentials already configured on the pod.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import time

POD_ID="xn73vwwekavcc6"
ROOT=Path(os.getenv("JHADINA_GPU_ROOT","/workspace/jhadina"))
REPO=ROOT/"crispy-waddle"
SOURCE_REF=os.getenv("DIRECTOR_SOURCE_REF","main")


def run(args:list[str],*,env:dict[str,str]|None=None,check:bool=True)->subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=check,
        env=env,
        text=True,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )


def process_exists(pattern:str)->bool:
    result=subprocess.run(
        ["pgrep","-f",pattern],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode==0


def ensure_repo()->None:
    ROOT.mkdir(parents=True,exist_ok=True)
    if not (REPO/".git").is_dir():
        run(["git","clone","https://github.com/bookieandco/crispy-waddle.git",str(REPO)])
    run(["git","-C",str(REPO),"fetch","origin",SOURCE_REF])
    run(["git","-C",str(REPO),"checkout",SOURCE_REF])
    run(["git","-C",str(REPO),"pull","--ff-only","origin",SOURCE_REF])


def bool_env(name:str)->bool:
    return os.getenv(name,"").strip().lower()=="true"


def main()->int:
    ensure_repo()
    env=os.environ.copy()
    env["DIRECTOR_SOURCE_REF"]=SOURCE_REF

    if process_exists(r"uvicorn app:app .*--port 8091|uvicorn app:app --host 0\.0\.0\.0 --port 8091"):
        print(f"MUSIC_RESTORATION_REMOTE_COMMISSION:pod={POD_ID}:mode=retrofit")
        run(["bash",str(REPO/"scripts/music-restoration-runpod-commission.sh")],env=env)
        return 0

    missing:list[str]=[]
    if not os.getenv("HF_TOKEN","").strip():
        missing.append("HF_TOKEN")
    if not bool_env("DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED"):
        missing.append("DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true")
    if not bool_env("DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED"):
        missing.append("DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true")
    if missing:
        print(
            "MUSIC_RESTORATION_REMOTE_COMMISSION_ENV_MISSING:"+",".join(missing),
            file=sys.stderr,
        )
        return 3

    log_path=ROOT/"hunyuan-bootstrap.log"
    print(f"MUSIC_RESTORATION_REMOTE_COMMISSION:pod={POD_ID}:mode=full-bootstrap")
    with log_path.open("ab",buffering=0) as log:
        child=subprocess.Popen(
            ["bash",str(REPO/"scripts/director-hunyuan-runpod-bootstrap.sh")],
            cwd=str(REPO),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
        )
    print(f"MUSIC_RESTORATION_REMOTE_BOOTSTRAP_STARTED:pid={child.pid}:log={log_path}")

    # Fail early if the detached bootstrap exits immediately; otherwise the
    # GitHub caller polls the public health routes while model/bootstrap work runs.
    time.sleep(3)
    code=child.poll()
    if code is not None:
        print(f"MUSIC_RESTORATION_REMOTE_BOOTSTRAP_EARLY_EXIT:{code}",file=sys.stderr)
        return code or 1
    return 0


if __name__=="__main__":
    raise SystemExit(main())
