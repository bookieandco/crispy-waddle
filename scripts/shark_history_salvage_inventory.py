#!/usr/bin/env python3
"""SHARK-HISTORY-SALVAGE.01: explicit-root, read-only original-file discovery.

Only content hashes and hashed relative locators leave this process. Filenames
and extensions never prove an artifact came from historical Shadow. Never
imports into trading, opens Supabase, runs Docker, or follows symlinks.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

SUPPORTED = {".dump", ".backup", ".sql", ".json", ".jsonl", ".ndjson",
             ".csv", ".parquet", ".sqlite", ".db", ".zip", ".tar", ".gz"}
MAX_FILES = 1500
MAX_FILE_BYTES = 512 * 1024 * 1024
MAX_TOTAL_BYTES = 1024 * 1024 * 1024


class SalvageInventoryError(ValueError):
    pass


def check_root(path: Path) -> Path:
    absolute = path.absolute()
    if (not path.is_absolute() or str(path) == "/" or path.is_symlink()
            or not path.is_dir() or path.resolve() != absolute):
        raise SalvageInventoryError("EXPLICIT_NON_SYMLINK_LOCAL_ROOT_REQUIRED")
    return path


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def inspect_file(path: Path, *, root: Path) -> dict | None:
    if path.is_symlink() or path.suffix.lower() not in SUPPORTED:
        return None
    meta = path.stat(follow_symlinks=False)
    if (not stat.S_ISREG(meta.st_mode) or meta.st_size < 1
            or meta.st_size > MAX_FILE_BYTES):
        return None
    rel = path.relative_to(root).as_posix()
    lowered = rel.lower()
    synthetic = bool(re.search(r"synthetic|canary|fixture", lowered))
    suffix = path.suffix.lower()
    sha = hashlib.sha256()
    with path.open("rb") as f:
        header = f.read(5)
        f.seek(0)
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            sha.update(chunk)
    if synthetic:
        kind = "SYNTHETIC"
    elif suffix in (".dump", ".backup") and header == b"PGDMP":
        kind = "ORIGINAL_DB_CANDIDATE"
    elif suffix in (".jsonl", ".ndjson", ".csv", ".sqlite", ".db") and "shadow" in lowered:
        kind = "ORIGINAL_EXPORT_CANDIDATE"
    elif suffix in (".csv", ".parquet", ".jsonl", ".ndjson"):
        kind = "MARKET_ARCHIVE"
    else:
        kind = "HANDOFF"
    return {
        "id": "local-salvage:" + fingerprint(rel),
        "kind": kind,
        "origin": "OWNER_LOCAL",
        "sha256": sha.hexdigest(),
        "bytes": meta.st_size,
        "sourceRef": "local-relative-path-sha256:" + fingerprint(rel),
        "discoveredAt": datetime.now(timezone.utc).isoformat(),
        "fileNameExposed": False,
        "originalProvenanceVerified": False,
        "mayUpdateForwardLearning": False,
        "canExecute": False,
        "canAuthorizeLive": False,
    }


def inventory(root: Path) -> dict:
    root = check_root(root)
    rows: list[dict] = []
    scanned_bytes = 0
    for current, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs
                         if not (Path(current) / d).is_symlink()
                         and not d.startswith("."))
        for name in sorted(names):
            path = Path(current) / name
            if path.is_symlink() or path.suffix.lower() not in SUPPORTED:
                continue
            if len(rows) >= MAX_FILES:
                raise SalvageInventoryError("FILE_COUNT_LIMIT_REACHED")
            m = path.stat(follow_symlinks=False)
            if m.st_size > MAX_FILE_BYTES:
                continue
            scanned_bytes += m.st_size
            if scanned_bytes > MAX_TOTAL_BYTES:
                raise SalvageInventoryError("TOTAL_BYTE_LIMIT_REACHED")
            row = inspect_file(path, root=root)
            if row:
                rows.append(row)
    return {
        "schema": "SHARK-HISTORY-SALVAGE-DISCOVERY.v1",
        "rootFingerprint": fingerprint(str(root)),
        "filesExamined": len(rows),
        "bytesExamined": scanned_bytes,
        "entries": rows,
        "originalLedgerRecovered": False,
        "originalProvenanceVerified": False,
        "realMoneyAuthority": False,
        "writeOperationsPerformed": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", required=True, type=Path)
    ap.add_argument("--out", type=Path, help="New private receipt path; never overwrite")
    args = ap.parse_args()
    try:
        report = inventory(args.root)
        encoded = json.dumps(report, sort_keys=True, indent=2) + "\n"
        if args.out:
            if not args.out.is_absolute() or args.out.is_symlink():
                raise SalvageInventoryError("PRIVATE_OUTPUT_PATH_REQUIRED")
            fd = os.open(args.out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
        else:
            print(encoded, end="")
        return 0
    except (SalvageInventoryError, OSError):
        print("SHARK_SALVAGE_READONLY_INVENTORY_BLOCKED", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
