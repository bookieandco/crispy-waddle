#!/usr/bin/env python3
"""Reconcile Director services on the canonical RunPod GPU without exposing secrets.

The GitHub caller authenticates to RunPod with RUNPOD_API_KEY. This program runs
inside the Pod. Canonical RunPod workers authenticate production requests with
short-lived Vercel OIDC; optional static worker tokens may still exist on older
manual deployments. When Hunyuan is already running, its environment is
preserved by director-hunyuan-runpod-reconcile.sh. A cold bootstrap is only
attempted when the Pod itself already has the required license acknowledgements;
all model checkpoints used by the bootstrap are fetched from public pinned
sources.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(os.getenv("JHADINA_GPU_ROOT","/workspace/jhadina"))
REPO=ROOT/"crispy-waddle"
SOURCE_REF=os.getenv("DIRECTOR_SOURCE_REF","main")
HUNYUAN_PATTERN=r"uvicorn app:app .*--port 8091|uvicorn app:app --host 0\.0\.0\.0 --port 8091"
SPEAKER_PATTERN=r"uvicorn app:app .*--port 8092|uvicorn app:app --host 0\.0\.0\.0 --port 8092"
WATCH_PATTERN=r"python .*director-watch-worker/cloud_server\.py|python cloud_server\.py"
POST_PATTERN=r"uvicorn app:app .*--host 127\.0\.0\.1 .*--port 8097|uvicorn app:app --host 127\.0\.0\.1 --port 8097"


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


def start_detached(script:Path,log_name:str,env:dict[str,str])->int:
    log_path=ROOT/log_name
    with log_path.open("ab",buffering=0) as log:
        child=subprocess.Popen(
            ["bash",str(script)],
            cwd=str(REPO),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
        )
    time.sleep(3)
    code=child.poll()
    if code is not None:
        raise RuntimeError(f"DIRECTOR_RUNPOD_BOOTSTRAP_EARLY_EXIT:{script.name}:{code}")
    return child.pid


def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--pod-id",default=os.getenv("RUNPOD_POD_ID",""))
    args=parser.parse_args()

    ensure_repo()
    env=os.environ.copy()
    env["DIRECTOR_SOURCE_REF"]=SOURCE_REF
    state={
        "podId":args.pod_id or None,
        "sourceRef":SOURCE_REF,
        "hunyuan":{"state":"unknown"},
        "speakerQc":{"state":"unknown"},
        "watch":{"state":"unknown"},
        "post":{"state":"unknown"},
    }

    if process_exists(HUNYUAN_PATTERN):
        run(["bash",str(REPO/"scripts/director-hunyuan-runpod-reconcile.sh")],env=env)
        state["hunyuan"]={"state":"reconciled","productionProbe":"pending-public-check"}
    else:
        missing=[]
        if not bool_env("DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED"):
            missing.append("DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true")
        if not bool_env("DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED"):
            missing.append("DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true")
        if missing:
            state["hunyuan"]={"state":"blocked-cold-bootstrap","missing":missing}
            print(json.dumps(state,sort_keys=True))
            return 3
        pid=start_detached(REPO/"scripts/director-hunyuan-runpod-bootstrap.sh","hunyuan-bootstrap.log",env)
        state["hunyuan"]={"state":"cold-bootstrap-started","pid":pid,"productionProbe":"pending-public-check"}

    if process_exists(SPEAKER_PATTERN):
        state["speakerQc"]={"state":"running","authMode":"vercel-oidc","staticTokenFallbackSupported":True}
    else:
        pid=start_detached(REPO/"scripts/director-speaker-qc-runpod-bootstrap.sh","speaker-qc-bootstrap.log",env)
        state["speakerQc"]={
            "state":"bootstrap-started",
            "pid":pid,
            "authMode":"vercel-oidc",
            "staticTokenFallbackSupported":True,
        }

    if process_exists(WATCH_PATTERN):
        state["watch"]={"state":"running","transport":"hunyuan-authenticated-proxy","vlmBackend":"local-qwen"}
    else:
        pid=start_detached(REPO/"scripts/director-watch-runpod-sidecar-bootstrap.sh","watch-sidecar-bootstrap.log",env)
        state["watch"]={
            "state":"bootstrap-started",
            "pid":pid,
            "transport":"hunyuan-authenticated-proxy",
            "vlmBackend":"local-qwen",
        }

    if process_exists(POST_PATTERN):
        state["post"]={"state":"running","transport":"loopback-only","commissioning":"receipt-required"}
    else:
        pid=start_detached(REPO/"scripts/director-post-runpod-bootstrap.sh","post-sidecar-bootstrap.log",env)
        state["post"]={
            "state":"bootstrap-started",
            "pid":pid,
            "transport":"loopback-only",
            "commissioning":"receipt-required",
        }

    print(json.dumps(state,sort_keys=True))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
