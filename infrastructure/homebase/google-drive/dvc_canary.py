#!/usr/bin/env python3
"""GOOGLE-HOMEBASE.6: tiny synthetic DVC Drive upload/remote-only restore.

Runs only on an approved worker with dedicated Google OAuth. It never reads
Jhadina production assets and never deletes files from Google Drive.
"""
import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import dvc_assets


class CanaryError(RuntimeError):
    pass


def check_operator(env: dict[str, str]) -> str:
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise CanaryError("No hosted Actions Google OAuth canary")
    if env.get("GOOGLE_HOMEBASE_DVC_CANARY_APPROVED") != "YES":
        raise CanaryError("Exact synthetic canary needs local owner approval")
    return dvc_assets.folder_url(env.get("GOOGLE_HOMEBASE_DVC_FOLDER_ID", ""))


def run(args: list[str], root: Path) -> None:
    completed = subprocess.run(args, cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
    if completed.returncode:
        raise CanaryError("DVC canary failed at " + args[1])


def remote_roundtrip(folder_url: str) -> dict:
    dvc_assets.ensure_installed()
    with tempfile.TemporaryDirectory(prefix="jhadina-dvc-canary-") as temporary:
        root=Path(temporary)
        os.chmod(root,0o700)
        run(["dvc","init","--no-scm"],root)
        run(["dvc","remote","add","--local",dvc_assets.REMOTE_NAME,folder_url],root)
        run(["dvc","remote","modify","--local",dvc_assets.REMOTE_NAME,
             "profile","jhadina-homebase-assets"],root)
        # A freshly allocated cache within the scratch repo makes the restore
        # prove a remote download after the local cache is erased.
        run(["dvc","config","--local","cache.dir",".dvc/cache"],root)
        data=secrets.token_bytes(64)
        expected=hashlib.sha256(data).hexdigest()
        (root/"assets").mkdir()
        asset=root/"assets"/"synthetic-canary.bin"
        asset.write_bytes(data)
        run(["dvc","add","assets/synthetic-canary.bin"],root)
        run(["dvc","push","-r",dvc_assets.REMOTE_NAME,"assets/synthetic-canary.bin.dvc"],root)
        cache=root/".dvc"/"cache"
        if not cache.is_dir() or cache.is_symlink() or cache.resolve().parent!=(root/".dvc").resolve():
            raise CanaryError("Cannot prove private DVC cache locality; refusing destructive cache test")
        asset.unlink()
        shutil.rmtree(cache)  # scratch cache ONLY; never system/production cache
        run(["dvc","pull","-r",dvc_assets.REMOTE_NAME,"assets/synthetic-canary.bin.dvc"],root)
        if not asset.is_file() or hashlib.sha256(asset.read_bytes()).hexdigest()!=expected:
            raise CanaryError("Synthetic file not recovered byte-for-byte from Drive")
        return {"schema":"jhadina.google-homebase.dvc-canary.v1",
                "payload_classification":"SYNTHETIC_NON_SENSITIVE",
                "size_bytes":len(data),"sha256":expected,
                "remote_only_restore_verified":True,
                "worker_oauth_verified":True,
                "production_asset_touched":False,
                "remote_deletion_performed":False}


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live",action="store_true",help="Required before any cloud data transfer")
    a=parser.parse_args()
    try:
        if not a.live:
            raise CanaryError("Dry by default; supply --live on authorized worker")
        os.umask(0o077)
        folder=check_operator(dict(os.environ))
        print(json.dumps(remote_roundtrip(folder),sort_keys=True))
        return 0
    except (CanaryError,dvc_assets.DvcSetupError,OSError,subprocess.TimeoutExpired) as exc:
        print("GOOGLE_DVC_CANARY_BLOCKED: "+str(exc),file=sys.stderr)
        return 2


if __name__=="__main__":
    raise SystemExit(main())
