#!/usr/bin/env python3
"""Music Restoration -> existing Google Homebase DVC transport.

Fail closed: only explicitly cleared audio, no automatic uploads, no tokens,
no privileged database reads, no destructive cache cleanup. Runs on a separately
authorized Linux worker, never on the owner's iPhone/ChatGPT OAuth session.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

import dvc_assets

HEX = re.compile(r"[0-9a-f]{64}\Z")
SAFE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\Z")
EXTENSIONS = {".wav", ".flac", ".mp3", ".m4a", ".aac", ".ogg", ".mid"}
MAX_TRACKS = 64
MAX_FILE_BYTES = 1024 * 1024 * 1024
SUBSYSTEM = "music"


class MusicArchiveError(RuntimeError):
    pass


def checksum(path: Path) -> str:
    return dvc_assets.sha256_file(path)


def valid_name(value: object) -> str:
    if not isinstance(value, str) or not SAFE.fullmatch(value) or value in {".", ".."}:
        raise MusicArchiveError("Expected a single safe name, never a path")
    return value


def exact_regular(root: Path, name: str, *, must_exist: bool = True) -> Path:
    name = valid_name(name)
    base = root.resolve()
    path = base / name
    if path.is_symlink() or path.resolve().parent != base:
        raise MusicArchiveError("Symlink or path escape refused")
    if must_exist:
        if not path.is_file() or path.stat().st_size == 0:
            raise MusicArchiveError("Missing or empty audio artifact")
        if path.stat().st_size > MAX_FILE_BYTES:
            raise MusicArchiveError("Audio artifact exceeds per-file cap")
    return path


def inspect_manifest(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 256 * 1024:
        raise MusicArchiveError("Missing, symlinked or oversized DAW manifest")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise MusicArchiveError("DAW manifest must be an object")
    case_id = manifest.get("caseId")
    version_id = manifest.get("currentVersionId")
    if not isinstance(case_id, str) or not case_id.strip() or len(case_id) > 160:
        raise MusicArchiveError("caseId required")
    if not isinstance(version_id, str) or not version_id.strip() or len(version_id) > 160:
        raise MusicArchiveError("currentVersionId required")
    tracks = manifest.get("tracks")
    if not isinstance(tracks, list) or not 1 <= len(tracks) <= MAX_TRACKS:
        raise MusicArchiveError("DAW manifest must contain 1-64 tracks")
    ids, names = set(), set()
    cleaned = []
    for item in tracks:
        if not isinstance(item, dict):
            raise MusicArchiveError("Invalid track")
        artifact_id = item.get("artifactId")
        role = item.get("role")
        if not isinstance(artifact_id, str) or not artifact_id.strip() or len(artifact_id) > 240:
            raise MusicArchiveError("artifactId required")
        if not isinstance(role, str) or not role.strip() or len(role) > 100:
            raise MusicArchiveError("role required")
        name = valid_name(item.get("fileName"))
        digest = item.get("sha256")
        if not isinstance(digest, str) or not HEX.fullmatch(digest):
            raise MusicArchiveError("Every track must contain a SHA-256 digest")
        if Path(name).suffix.lower() not in EXTENSIONS:
            raise MusicArchiveError("Only supported audio extensions may be staged")
        if artifact_id in ids or name in names:
            raise MusicArchiveError("Duplicate audio artifact ID or filename")
        ids.add(artifact_id)
        names.add(name)
        cleaned.append({"artifactId": artifact_id, "role": role,
                        "fileName": name, "sha256": digest})
    return {"caseId": case_id, "currentVersionId": version_id,
            "tracks": cleaned, "sourceArtifactId": manifest.get("sourceArtifactId")}


def manifest_digest(manifest: dict) -> str:
    raw = json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def receipt_location(workspace: Path, manifest: dict) -> Path:
    return workspace / ".music-receipts" / (manifest_digest(manifest) + ".json")


def stage_name(manifest: dict, track: dict) -> str:
    tag = hashlib.sha256((manifest["caseId"] + ":" + track["artifactId"]).encode()).hexdigest()[:16]
    return "music-" + tag + "-" + track["sha256"][:16] + Path(track["fileName"]).suffix.lower()


def write_immutable(path: Path, contents: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise MusicArchiveError("Receipt or destination symlink refused")
    fd, tmp = tempfile.mkstemp(prefix=".music-tmp-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as writer:
            writer.write(contents)
            writer.flush()
            os.fsync(writer.fileno())
        try:
            os.link(tmp, path)  # O_EXCL-like, never replaces existing bytes
        except FileExistsError:
            if path.read_bytes() != contents:
                raise MusicArchiveError("Existing immutable receipt/artifact differs")
    finally:
        os.unlink(tmp)


def load_receipt(workspace: Path, manifest: dict) -> dict:
    path = receipt_location(workspace, manifest)
    if path.is_symlink() or not path.is_file():
        raise MusicArchiveError("Archive is not locally staged with a receipt")
    receipt = json.loads(path.read_text(encoding="utf-8"))
    if (receipt.get("manifestSha256") != manifest_digest(manifest)
            or receipt.get("classification") not in dvc_assets.ASSET_CLASSES
            or not receipt.get("rightsVerified")
            or not receipt.get("authorizationId")
            or len(receipt.get("assets", [])) != len(manifest["tracks"])):
        raise MusicArchiveError("Archive receipt lacks clearance/provenance")
    for track, item in zip(manifest["tracks"], receipt["assets"]):
        if item.get("artifactId") != track["artifactId"] or item.get("sha256") != track["sha256"] or item.get("name") != stage_name(manifest, track):
            raise MusicArchiveError("Archive manifest/receipt tampered or mismatched")
    return receipt


def stage(workspace: Path, sources: Path, manifest: dict, classification: str,
          rights_verified: bool, authorization_id: str) -> dict:
    if classification not in dvc_assets.ASSET_CLASSES or not rights_verified or not authorization_id.strip():
        raise MusicArchiveError("Explicit cleared classification, rights and authorization required")
    if not (workspace / ".dvc").is_dir():
        raise MusicArchiveError("Existing Google Homebase DVC workspace must be bootstrapped first")
    source_root = sources.resolve()
    if source_root == (workspace / "assets").resolve():
        raise MusicArchiveError("Use an independent source directory")
    # Validate every input before copying any bytes.
    for track in manifest["tracks"]:
        src = exact_regular(source_root, track["fileName"])
        if checksum(src) != track["sha256"]:
            raise MusicArchiveError("Audio differs from source DAW export manifest")
    dest_root = workspace / "assets"
    dest_root.mkdir(parents=True, exist_ok=True)
    assets = []
    for track in manifest["tracks"]:
        name = stage_name(manifest, track)
        target = exact_regular(dest_root, name, must_exist=False)
        if target.exists():
            if not target.is_file() or checksum(target) != track["sha256"]:
                raise MusicArchiveError("Staged artifact collision; never overwrite")
        else:
            src = exact_regular(source_root, track["fileName"])
            with src.open("rb") as reader:
                fd, temporary = tempfile.mkstemp(prefix=".music-stage-", dir=dest_root)
                try:
                    os.fchmod(fd, 0o600)
                    with os.fdopen(fd, "wb") as output:
                        shutil.copyfileobj(reader, output, 1024 * 1024)
                        output.flush()
                        os.fsync(output.fileno())
                    if checksum(Path(temporary)) != track["sha256"]:
                        raise MusicArchiveError("Staged bytes changed during copy")
                    os.link(temporary, target)
                finally:
                    os.unlink(temporary)
        assets.append({"name": name, "sha256": track["sha256"],
                       "artifactId": track["artifactId"], "role": track["role"]})
    receipt = {
        "schema": "music-drive-1",
        "caseId": manifest["caseId"], "versionId": manifest["currentVersionId"],
        "sourceArtifactId": manifest["sourceArtifactId"],
        "manifestSha256": manifest_digest(manifest),
        "classification": classification, "rightsVerified": True,
        "authorizationId": authorization_id, "assets": assets,
        "localBytesVerified": True, "dvcRemoteVerified": False,
        "productionRestorationCertified": False,
    }
    write_immutable(receipt_location(workspace, manifest),
                    (json.dumps(receipt, sort_keys=True, indent=2) + "\n").encode())
    return receipt


def track(workspace: Path, manifest: dict) -> dict:
    receipt = load_receipt(workspace, manifest)
    for item in receipt["assets"]:
        asset = exact_regular(workspace / "assets", item["name"])
        if checksum(asset) != item["sha256"]:
            raise MusicArchiveError("Staged audio hash mismatch; DVC track blocked")
    for item in receipt["assets"]:
        dvc_assets.track(workspace, item["name"], receipt["classification"], SUBSYSTEM)
    return {"state": "TRACKED_LOCALLY", "count": len(receipt["assets"]), "uploaded": False}


def require_remote(workspace: Path, folder_id: str, manifest: dict) -> dict:
    receipt = load_receipt(workspace, manifest)
    dvc_assets.folder_url(folder_id)
    if not dvc_assets.remote_configured(workspace, folder_id):
        raise MusicArchiveError("Exact Google Homebase DVC remote not configured")
    for item in receipt["assets"]:
        path = workspace / "assets" / (item["name"] + ".dvc")
        if path.is_symlink() or not path.is_file():
            raise MusicArchiveError("Versioned DVC pointer required")
        approval = dvc_assets.load_approval(workspace, item["name"])
        if (approval.get("sha256") != item["sha256"]
                or approval.get("classification") != receipt["classification"]
                or approval.get("subsystem") != SUBSYSTEM):
            raise MusicArchiveError("Exact approved DVC record required")
    return receipt


def live_authorized(live: bool) -> None:
    if not live or os.getenv("MUSIC_DRIVE_LIVE_APPROVED") != "YES":
        raise MusicArchiveError("Explicit --live and MUSIC_DRIVE_LIVE_APPROVED=YES required")


def push(workspace: Path, folder_id: str, manifest: dict, live: bool) -> dict:
    live_authorized(live)
    receipt = require_remote(workspace, folder_id, manifest)
    for item in receipt["assets"]:
        if checksum(exact_regular(workspace / "assets", item["name"])) != item["sha256"]:
            raise MusicArchiveError("Pre-push SHA mismatch")
    for item in receipt["assets"]:
        dvc_assets.push(workspace, folder_id, item["name"])
    return {"state": "DVC_PUSH_COMMAND_SUCCEEDED", "count": len(receipt["assets"]),
            "remoteRestoreProven": False, "productionRestorationCertified": False}


def restore(workspace: Path, folder_id: str, manifest: dict, live: bool) -> dict:
    live_authorized(live)
    receipt = require_remote(workspace, folder_id, manifest)
    # Prove remote-only retrieval. Never silently accept a local cached file.
    for item in receipt["assets"]:
        target = exact_regular(workspace / "assets", item["name"], must_exist=False)
        if target.exists():
            raise MusicArchiveError("Remote-only restore needs absent local audio; no deletion is performed")
    for item in receipt["assets"]:
        dvc_assets.pull(workspace, folder_id, item["name"])
        restored = exact_regular(workspace / "assets", item["name"])
        if checksum(restored) != item["sha256"]:
            raise MusicArchiveError("Remote download failed independent SHA verification")
    return {"state": "REMOTE_ONLY_DVC_RESTORE_SHA256_VERIFIED",
            "count": len(receipt["assets"]), "remoteRestoreProven": True,
            "productionRestorationCertified": False}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["stage", "track", "push", "restore", "verify"])
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--workspace", type=Path, default=dvc_assets.DEFAULT_WORKSPACE)
    parser.add_argument("--classification", choices=dvc_assets.ASSET_CLASSES)
    parser.add_argument("--rights-verified", action="store_true")
    parser.add_argument("--authorization-id")
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args(argv)
    try:
        os.umask(0o077)
        manifest = inspect_manifest(args.manifest)
        workspace = args.workspace.resolve()
        if args.operation == "stage":
            if not args.source_dir:
                raise MusicArchiveError("--source-dir required for staging")
            result = stage(workspace, args.source_dir, manifest, args.classification or "",
                           args.rights_verified, args.authorization_id or "")
        elif args.operation == "track":
            result = track(workspace, manifest)
        elif args.operation == "verify":
            receipt = load_receipt(workspace, manifest)
            result = {"state": "LOCAL_MANIFEST_VERIFIED", "count": len(receipt["assets"])}
            for item in receipt["assets"]:
                if checksum(exact_regular(workspace / "assets", item["name"])) != item["sha256"]:
                    raise MusicArchiveError("Local SHA mismatch")
        else:
            folder_id = os.environ.get("GOOGLE_HOMEBASE_DVC_FOLDER_ID", "")
            result = (push(workspace, folder_id, manifest, args.live)
                      if args.operation == "push" else restore(workspace, folder_id, manifest, args.live))
        print(json.dumps(result, sort_keys=True))
        return 0
    except (MusicArchiveError, dvc_assets.DvcSetupError, OSError, ValueError, KeyError, TypeError,
            json.JSONDecodeError) as exc:
        print("MUSIC_DRIVE_BLOCKED: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
