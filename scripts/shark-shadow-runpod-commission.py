#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, subprocess, sys
from pathlib import Path

ROOT=Path(os.getenv("JHADINA_GPU_ROOT","/workspace/jhadina"))
REPO=ROOT/"crispy-waddle"
SOURCE_REF=os.getenv("SHARK_SHADOW_SOURCE_REF","main")

def run(args:list[str],*,env:dict[str,str]|None=None)->None:
    subprocess.run(args,check=True,env=env,text=True,stdout=sys.stdout,stderr=sys.stderr)

def main()->int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--pod-id",default=os.getenv("RUNPOD_POD_ID",""))
    args=parser.parse_args()
    ROOT.mkdir(parents=True,exist_ok=True)
    if not (REPO/".git").is_dir():
        run(["git","clone","https://github.com/bookieandco/crispy-waddle.git",str(REPO)])
    run(["git","-C",str(REPO),"fetch","origin",SOURCE_REF])
    run(["git","-C",str(REPO),"checkout",SOURCE_REF])
    run(["git","-C",str(REPO),"pull","--ff-only","origin",SOURCE_REF])
    env=os.environ.copy()
    env["SHARK_SHADOW_SOURCE_REF"]=SOURCE_REF
    run(["bash",str(REPO/"scripts/shark-shadow-runpod-bootstrap.sh")],env=env)
    receipt=ROOT/"shark-shadow"/"runtime-receipt.json"
    output={"podId":args.pod_id or None,"sourceRef":SOURCE_REF,"receipt":str(receipt),"authority":"SHADOW_LEARNING_ONLY","canExecute":False}
    if receipt.exists():
        try: output["runtime"]=json.loads(receipt.read_text())
        except Exception: pass
    print(json.dumps(output,sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
