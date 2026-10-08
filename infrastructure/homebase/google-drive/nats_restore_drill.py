#!/usr/bin/env python3
"""Disaster drill: restore encrypted JetStream archive to a disposable local server.

No production stream mutation. Separate from the online archival routine and
allowed only on an existing, trusted host. The drill does not prove durable
consumer ack positions or all streams are recoverable.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import backup
import nats_backup


class JetstreamRestoreError(RuntimeError):
    pass


def validate_source_receipt(data: dict) -> tuple[str, str, str]:
    if (not isinstance(data, dict)
            or data.get("schema") != "jhadina.google-homebase.jetstream-backup.v1"
            or data.get("scope") != "ONE_NATS_STREAM_WITH_CONSUMER_SNAPSHOT"
            or data.get("encrypted_with_restic") is not True
            or data.get("remote_bytes_restored_verified") is not True
            or data.get("nats_archive_offline_validated") is not True):
        raise JetstreamRestoreError("Source receipt has no encrypted JetStream archive proof")
    stream = data.get("stream")
    snapshot = data.get("snapshot_id")
    digest = data.get("sha256_archive_manifest")
    if (not isinstance(stream, str) or not nats_backup.STREAM.fullmatch(stream)
            or not isinstance(snapshot, str)
            or not re.fullmatch(r"[a-f0-9]{8,64}", snapshot)
            or not isinstance(digest, str)
            or not re.fullmatch(r"[a-f0-9]{64}", digest)):
        raise JetstreamRestoreError("Invalid exact stream, snapshot or archive hash")
    return stream, snapshot, digest


def owner_trust(env: dict[str, str]) -> None:
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise JetstreamRestoreError("Private NATS restore disallowed on hosted CI")
    if (env.get("JHADINA_NATS_RESTORE_TRUST_DOMAIN") != "OWNER_CONTROLLED"
            or env.get("JHADINA_NATS_RESTORE_APPROVED") != "YES"):
        raise JetstreamRestoreError("Explicit owner-controlled restore approval required")


def local_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def detached_server_drill(archive: Path, stream: str, work: Path) -> int:
    """Only creates a disposable NATS instance bound to local loopback."""
    for binary in ("nats", "nats-server"):
        nats_backup.backup.require_binary(binary)
    storage = work / "nats-isolated-storage"
    storage.mkdir(mode=0o700)
    port = local_port()
    url = f"nats://127.0.0.1:{port}"
    server = subprocess.Popen(
        ["nats-server", "-js", "-sd", str(storage), "-a", "127.0.0.1", "-p", str(port)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=work,
    )
    try:
        for _ in range(40):
            if server.poll() is not None:
                raise JetstreamRestoreError("Disposable NATS server exited unexpectedly")
            ready = nats_backup.execute(["nats", "--server", url, "server", "ping"],
                                        work, timeout=4)
            if ready.returncode == 0:
                break
            time.sleep(0.25)
        else:
            raise JetstreamRestoreError("Disposable NATS server never became ready")
        result = nats_backup.execute(
            ["nats", "--server", url, "backup", "restore", "stream", str(archive)],
            work, timeout=180,
        )
        if result.returncode:
            raise JetstreamRestoreError("Offline NATS stream API restore failed")
        info = nats_backup.execute(
            ["nats", "--server", url, "--json", "stream", "info", stream],
            work, timeout=30, capture=True,
        )
        if info.returncode:
            raise JetstreamRestoreError("Restored stream info request failed")
        try:
            parsed = json.loads(info.stdout)
            state = parsed.get("state", {})
            config = parsed.get("config", {})
            count = state["messages"]
            if (config.get("name") != stream
                    or not isinstance(count, int) or isinstance(count, bool)
                    or count < 1):
                raise ValueError("Empty or incorrect restored stream")
        except (ValueError, KeyError, TypeError, AttributeError):
            raise JetstreamRestoreError("Restored stream contents cannot be verified") from None
        return count
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=8)


def drill(receipt_path: Path, env: dict[str, str]) -> dict:
    owner_trust(env)
    if receipt_path.is_symlink() or not receipt_path.is_file() or receipt_path.stat().st_mode & 0o077:
        raise JetstreamRestoreError("Private owner-only NATS backup receipt required")
    stream, snapshot, expected = validate_source_receipt(
        json.loads(receipt_path.read_text(encoding="utf-8")))
    repository = backup.repository_from_env(env)
    backup.require_password_file(env)
    backup.require_binary("restic")
    backup.require_binary("rclone")
    backup.remote_check(env)
    root = env.get("JHADINA_NATS_RESTORE_STAGING_ROOT") or None
    with tempfile.TemporaryDirectory(prefix="nats-restore-drill-", dir=root) as tmp:
        work = Path(tmp)
        os.chmod(work, 0o700)
        output = work / "retrieved"
        output.mkdir()
        retrieved = nats_backup.execute(
            ["restic", "-r", repository, "restore", snapshot, "--target", str(output)],
            work, timeout=900,
        )
        if retrieved.returncode:
            raise JetstreamRestoreError("Encrypted NATS archive restore failed")
        folder = output / "nats-stream-backup"
        digest, _, _ = nats_backup.archive_manifest(folder)
        if digest != expected:
            raise JetstreamRestoreError("Restored NATS archive SHA256 differs from receipt")
        if nats_backup.execute(
                ["nats", "backup", "validate", str(folder)], work, timeout=120
        ).returncode:
            raise JetstreamRestoreError("NATS archive offline validation failed")
        restored_messages = detached_server_drill(folder, stream, work)
    return {
        "schema": "jhadina.google-homebase.jetstream-restore-drill.v1",
        "source_snapshot_id": snapshot,
        "source_stream": stream,
        "source_sha256": expected,
        "restored_message_count": restored_messages,
        "isolated_loopback_server": True,
        "production_nats_mutated": False,
        "nats_api_restore_tested": True,
        "consumer_ack_positions_tested": False,
        "all_streams_restored": False,
    }


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    try:
        os.umask(0o077)
        print(json.dumps(drill(args.receipt, dict(os.environ)), sort_keys=True))
        return 0
    except (JetstreamRestoreError, nats_backup.StreamBackupError,
            backup.BackupError, OSError, ValueError, subprocess.TimeoutExpired) as err:
        print("GOOGLE_HOMEBASE_NATS_RESTORE_BLOCKED: " + str(err), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
