#!/usr/bin/env python3
"""Reconcile a dedicated Jhadina voice RunPod without exposing runtime secrets."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(os.getenv("JHADINA_GPU_ROOT", "/workspace/jhadina"))
REPO = ROOT / "crispy-waddle"
SOURCE_REF = os.getenv("JHADINA_SOURCE_REF", "main")


def run(args: list[str], *, env: dict[str, str] | None = None) -> None:
    subprocess.run(args, check=True, env=env, text=True, stdout=sys.stdout, stderr=sys.stderr)


def ensure_repo() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    if not (REPO / ".git").is_dir():
        run(["git", "clone", "https://github.com/bookieandco/crispy-waddle.git", str(REPO)])
    run(["git", "-C", str(REPO), "fetch", "origin", SOURCE_REF])
    run(["git", "-C", str(REPO), "checkout", SOURCE_REF])
    run(["git", "-C", str(REPO), "pull", "--ff-only", "origin", SOURCE_REF])


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pod-id", default=os.getenv("RUNPOD_POD_ID", ""))
    args = parser.parse_args()

    phase = os.getenv("JHADINA_VOICE_PHASE", "audition").strip()
    if phase not in {"audition", "production"}:
        print("JHADINA_VOICE_PHASE_INVALID", file=sys.stderr)
        return 2

    ensure_repo()
    env = os.environ.copy()
    env["JHADINA_SOURCE_REF"] = SOURCE_REF
    run(["bash", str(REPO / "scripts/jhadina-voice-runpod-bootstrap.sh")], env=env)

    state: dict[str, object] = {
        "podId": args.pod_id or None,
        "phase": phase,
        "sourceRef": SOURCE_REF,
        "qwen": get_json("http://127.0.0.1:8093/health"),
    }
    if phase == "production":
        state["voxcpm"] = get_json("http://127.0.0.1:8094/health")
        state["voice"] = get_json("http://127.0.0.1:8095/health")
        state["speakerQc"] = get_json("http://127.0.0.1:8096/health")

    print(json.dumps(state, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
