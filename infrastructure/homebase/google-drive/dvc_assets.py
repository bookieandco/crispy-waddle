#!/usr/bin/env python3
"""Optional, isolated DVC+Google Drive asset transport (not a backup authority).

Run on Homebase with its own Google OAuth credentials. Nothing in this program
reads ChatGPT tokens or changes Supabase, RunPod, PostgreSQL or Restic backups.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REMOTE_NAME = "jhadina-assets"
DEFAULT_WORKSPACE = Path(__file__).resolve().parent / "dvc-workspace"
ASSET_CLASSES = ("PUBLIC", "CLEARED_NON_SENSITIVE")
FOLDER_ID_RE = re.compile(r"[A-Za-z0-9_-]{10,128}\Z")
ASSET_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\Z")
SUBSYSTEM_RE = re.compile(r"[a-z][a-z0-9_-]{1,63}\Z")


class DvcSetupError(RuntimeError):
    pass


def folder_url(folder_id: str) -> str:
    if not FOLDER_ID_RE.fullmatch(folder_id):
        raise DvcSetupError("GOOGLE_HOMEBASE_DVC_FOLDER_ID must be an exact Google Drive folder ID")
    return f"gdrive://{folder_id}"


def validated_asset(workspace: Path, name: str, *, require_file: bool) -> Path:
    if not ASSET_RE.fullmatch(name) or name in {".", ".."} or name.endswith(".dvc"):
        raise DvcSetupError("Asset name must be one safe filename, not a path")
    assets = (workspace / "assets").resolve()
    asset = assets / name
    if asset.is_symlink() or asset.resolve().parent != assets:
        raise DvcSetupError("Symlink or path escape forbidden")
    if require_file and (not asset.is_file() or asset.stat().st_size == 0):
        raise DvcSetupError("A nonempty, regular file is required in dvc-workspace/assets")
    return asset


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def command(args: list[str], workspace: Path, *, capture: bool = False) -> str:
    completed = subprocess.run(args, cwd=workspace, check=False,
                               stdout=subprocess.PIPE if capture else None)
    if completed.returncode:
        raise DvcSetupError(f"Command failed (exit {completed.returncode}): {args[0]} {args[1]}")
    return completed.stdout.decode("utf-8").strip() if capture else ""


def ensure_installed() -> None:
    if shutil.which("dvc") is None:
        raise DvcSetupError("DVC executable missing; install dvc and dvc-gdrive in a Homebase venv")


def approval_path(workspace: Path) -> Path:
    return workspace / ".asset-approvals.local.json"


def save_approval(workspace: Path, record: dict) -> None:
    path = approval_path(workspace)
    if path.is_symlink():
        raise DvcSetupError("Approval file must not be a symlink")
    previous = {}
    if path.is_file():
        previous = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(previous, dict):
            raise DvcSetupError("Invalid approval manifest")
    previous[record["name"]] = record
    fd, filename = tempfile.mkstemp(prefix=".dvc-approval-", dir=workspace)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(previous, out, sort_keys=True, indent=2)
            out.write("\n")
        os.replace(filename, path)
    finally:
        if os.path.exists(filename):
            os.unlink(filename)


def load_approval(workspace: Path, name: str) -> dict:
    path = approval_path(workspace)
    if path.is_symlink() or not path.is_file():
        raise DvcSetupError("No local approval manifest; no upload permitted")
    record = json.loads(path.read_text(encoding="utf-8")).get(name)
    if not isinstance(record, dict) or record.get("classification") not in ASSET_CLASSES:
        raise DvcSetupError("Asset lacks an approved non-sensitive classification")
    return record


def remote_configured(workspace: Path, folder_id: str) -> bool:
    result = subprocess.run(["dvc", "config", "--local", f"remote.{REMOTE_NAME}.url"],
                            cwd=workspace, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if result.returncode:
        return False
    found = result.stdout.decode("utf-8").strip()
    if found != folder_url(folder_id):
        raise DvcSetupError("Existing DVC remote folder differs; refusing to overwrite it")
    return True


def bootstrap(workspace: Path, folder_id: str) -> None:
    ensure_installed()
    url = folder_url(folder_id)
    workspace.mkdir(parents=True, exist_ok=True)
    if not (workspace / ".dvc").is_dir():
        command(["dvc", "init", "--subdir"], workspace)
    if not remote_configured(workspace, folder_id):
        command(["dvc", "remote", "add", "--local", REMOTE_NAME, url], workspace)
    # Each Jhadina remote receives distinct DVC OAuth credential cache identity.
    command(["dvc", "remote", "modify", "--local", REMOTE_NAME, "profile", "jhadina-homebase-assets"], workspace)
    (workspace / "assets").mkdir(exist_ok=True)
    print(json.dumps({"state": "REMOTE_CONFIGURED", "remote": REMOTE_NAME,
                      "machine_google_oauth_verified": False, "upload_performed": False}))


def track(workspace: Path, name: str, classification: str, subsystem: str) -> None:
    ensure_installed()
    if classification not in ASSET_CLASSES or not SUBSYSTEM_RE.fullmatch(subsystem):
        raise DvcSetupError("Explicit PUBLIC or CLEARED_NON_SENSITIVE classification and subsystem required")
    if not (workspace / ".dvc").is_dir():
        raise DvcSetupError("DVC workspace not initialized: run bootstrap")
    asset = validated_asset(workspace, name, require_file=True)
    digest = sha256_file(asset)
    command(["dvc", "add", f"assets/{name}"], workspace)
    save_approval(workspace, {"name": name, "sha256": digest,
                              "classification": classification, "subsystem": subsystem})
    print(json.dumps({"state": "TRACKED_LOCALLY", "asset": name, "sha256": digest,
                      "ready_for_git_metadata_commit": True, "upload_performed": False}))


def approved_target(workspace: Path, name: str) -> str:
    asset = validated_asset(workspace, name, require_file=True)
    record = load_approval(workspace, name)
    if sha256_file(asset) != record.get("sha256"):
        raise DvcSetupError("Asset bytes changed after approval; reclassify before upload")
    target = f"assets/{name}.dvc"
    if not (workspace / target).is_file():
        raise DvcSetupError("DVC pointer missing; track the asset first")
    return target


def push(workspace: Path, folder_id: str, name: str) -> None:
    ensure_installed()
    target = approved_target(workspace, name)
    if not remote_configured(workspace, folder_id):
        raise DvcSetupError("DVC Google Drive remote not configured for expected folder")
    command(["dvc", "push", "-r", REMOTE_NAME, target], workspace)
    print(json.dumps({"state": "DVC_PUSH_COMMAND_SUCCEEDED", "asset": name,
                      "restored_bytes_verified": False, "encrypted_backup": False}))


def pull(workspace: Path, folder_id: str, name: str) -> None:
    ensure_installed()
    if not remote_configured(workspace, folder_id):
        raise DvcSetupError("DVC Google Drive remote not configured for expected folder")
    validated_asset(workspace, name, require_file=False)
    target = f"assets/{name}.dvc"
    if not (workspace / target).is_file():
        raise DvcSetupError("DVC pointer missing; no untracked remote downloads")
    command(["dvc", "pull", "-r", REMOTE_NAME, target], workspace)
    print(json.dumps({"state": "DVC_PULL_COMMAND_SUCCEEDED", "asset": name}))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["doctor", "bootstrap", "track", "push", "pull"])
    parser.add_argument("--workspace", type=Path, default=DEFAULT_WORKSPACE)
    parser.add_argument("--asset", help="A single filename already under dvc-workspace/assets")
    parser.add_argument("--classification", choices=ASSET_CLASSES)
    parser.add_argument("--subsystem")
    args = parser.parse_args(argv)
    try:
        os.umask(0o077)
        workspace = args.workspace.resolve()
        if args.operation == "doctor":
            ensure_installed()
            print(json.dumps({"dvc_installed": True, "initialized": (workspace / ".dvc").is_dir(),
                              "machine_google_oauth_verified": False}))
            return 0
        folder_id = os.environ.get("GOOGLE_HOMEBASE_DVC_FOLDER_ID", "").strip()
        if args.operation in {"bootstrap", "push", "pull"}:
            folder_url(folder_id)
        if args.operation == "bootstrap":
            bootstrap(workspace, folder_id)
        elif args.operation == "track":
            if not args.asset or not args.classification or not args.subsystem:
                raise DvcSetupError("track needs --asset --classification and --subsystem")
            track(workspace, args.asset, args.classification, args.subsystem)
        elif args.operation in {"push", "pull"}:
            if not args.asset:
                raise DvcSetupError(f"{args.operation} needs --asset")
            if args.operation == "push":
                push(workspace, folder_id, args.asset)
            else:
                pull(workspace, folder_id, args.asset)
        return 0
    except (DvcSetupError, OSError, json.JSONDecodeError) as exc:
        print(f"GOOGLE_DVC_BLOCKED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
