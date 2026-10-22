#!/usr/bin/env python3
"""SHARK-OVH-READINESS.1: read-only Linux host and separate-volume admission.

Owner invokes after an OVHcloud VPS is actually provisioned. This is NOT
evidence of OVH ownership, server uptime, paid storage, encrypted backup,
machine Google OAuth or genuine SHARK market-data learning. No changes to
mounts, databases, packages, SSH, firewall, secrets, or hosting provider.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import stat
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Any

MIN_CPU = 4
MIN_RAM_BYTES = 6 * 1024**3
MIN_FREE_BYTES = 25 * 1024**3
EPHEMERAL = frozenset(("tmpfs", "overlay", "ramfs", "devtmpfs", "aufs", "squashfs"))
RUNTIME_BINARIES = ("git", "python3", "node", "pnpm", "findmnt", "psql",
                    "pg_dump", "pg_restore", "pg_ctl", "restic", "rclone",
                    "docker", "systemctl")


class ReadinessError(ValueError):
    pass


def parse_meminfo(text: str) -> int:
    for line in text.splitlines():
        if line.startswith("MemTotal:"):
            bits = line.split()
            if len(bits) == 3 and bits[2] == "kB" and bits[1].isdigit():
                return int(bits[1]) * 1024
    raise ReadinessError("MEMORY_PROBE_UNAVAILABLE")


def planned_path(candidate: Path) -> Path:
    if not candidate.is_absolute() or candidate == Path("/") or candidate.is_symlink():
        raise ReadinessError("PLANNED_DATA_PATH_UNSAFE")
    if any(part.is_symlink() for part in candidate.parents):
        raise ReadinessError("SYMLINKED_PATH_COMPONENT_REJECTED")
    return candidate


def probe(
    *, state_root: Path, env: dict[str, str],
    cpu_count: int, ram_bytes: int,
    mount: Callable[[Path], tuple[str, str, str] | None],
    disk: Callable[[Path], Any],
    which: Callable[[str], str | None],
    host_os: str, linux_distribution: str, now: datetime | None = None,
) -> dict:
    planned_path(state_root)
    if (env.get("SHARK_OVH_READ_ONLY_APPROVED") != "YES"
            or env.get("GITHUB_ACTIONS", "").lower() == "true"):
        raise ReadinessError("OWNER_READ_ONLY_HOST_PROBE_APPROVAL_REQUIRED")
    if host_os != "Linux":
        raise ReadinessError("LINUX_HOST_REQUIRED")
    blockers: list[str] = []
    if not isinstance(cpu_count, int) or cpu_count < MIN_CPU:
        blockers.append("MINIMUM_FOUR_VCPU_RECOMMENDED")
    if not isinstance(ram_bytes, int) or ram_bytes < MIN_RAM_BYTES:
        blockers.append("AT_LEAST_SIX_GIB_RAM_RECOMMENDED")
    if linux_distribution not in ("ubuntu:24.04", "ubuntu:22.04"):
        blockers.append("SUPPORTED_UBUNTU_LTS_REQUIRED")
    ancestor = state_root
    while not ancestor.exists() and ancestor != ancestor.parent:
        ancestor = ancestor.parent
    if not ancestor.is_dir() or ancestor.is_symlink():
        blockers.append("PLANNED_VOLUME_ANCESTOR_INVALID")
    mount_info = mount(ancestor) if ancestor.is_dir() else None
    mounted = False
    filesystem = None
    source_tag = None
    disk_free: int | None = None
    if mount_info is not None:
        target_raw, filesystem, source = mount_info
        target = Path(target_raw)
        if (target.is_absolute() and target != Path("/")
                and filesystem not in EPHEMERAL
                and (target == state_root or target in state_root.parents)
                and (target == ancestor or target in ancestor.parents)):
            mounted = True
            source_tag = hashlib.sha256(source.encode()).hexdigest()[:16]
            disk_free = int(disk(ancestor).free)
            if disk_free < MIN_FREE_BYTES:
                blockers.append("INSUFFICIENT_FREE_SPACE_ON_SEPARATE_VOLUME")
    if not mounted:
        blockers.append("SEPARATE_NON_EPHEMERAL_DATA_VOLUME_NOT_VERIFIED")
    missing = [binary for binary in RUNTIME_BINARIES if which(binary) is None]
    # Bootstrap may install dependencies later, but do not call the current
    # machine production-ready without them.
    if missing:
        blockers.append("WORKER_TOOLS_MISSING")
    if state_root.is_symlink() or (state_root.exists() and not state_root.is_dir()):
        blockers.append("PLANNED_DATA_ROOT_NOT_SAFE_DIRECTORY")
    return {
        "schema": "shark.ovh.owner-readiness.v1",
        "scannedAt": (now or datetime.now(timezone.utc)).isoformat(),
        "status": "READY_FOR_OPERATOR_REVIEW" if not blockers else "BLOCKED",
        "reasonCodes": sorted(set(blockers)),
        "cpuCoresObserved": cpu_count,
        "ramBytesObserved": ram_bytes,
        "ubuntuReleaseObserved": linux_distribution,
        "dedicatedVolumeMountObserved": mounted,
        "mountedFilesystemType": filesystem,
        "mountedSourceFingerprint": source_tag,
        "dataRootFingerprint": hashlib.sha256(str(state_root).encode()).hexdigest(),
        "freeBytesOnDataVolume": disk_free,
        "missingTools": missing,
        "physicalDiskPersistenceAcrossHostRebuildVerified": False,
        "uptimeVerified": False,
        "realMachineDriveOAuthVerified": False,
        "realShadowEncryptedBackupRestored": False,
        "realForwardPaperOutcomesVerified": False,
        "originalHistoryRecovered": False,
        "gpuRequiredForInitialPaper": False,
        "futureGpuProvisioningAuthorized": False,
        "productionCommissioned": False,
        "canExecute": False,
        "canAuthorizeLive": False,
    }


def os_release(path: Path = Path("/etc/os-release")) -> str:
    try:
        data = {}
        for row in path.read_text(encoding="utf-8").splitlines():
            if "=" in row:
                k, v = row.split("=", 1)
                data[k] = v.strip().strip('"')
        return f"{data.get('ID', 'unknown')}:{data.get('VERSION_ID', 'unknown')}"
    except (OSError, UnicodeDecodeError):
        return "unknown:unknown"


def actual_findmnt(path: Path) -> tuple[str, str, str] | None:
    r = subprocess.run(
        ["findmnt", "-T", str(path), "-no", "TARGET,FSTYPE,SOURCE"],
        capture_output=True, text=True, timeout=10, check=False)
    if r.returncode:
        return None
    fields = r.stdout.strip().split(maxsplit=2)
    return tuple(fields) if len(fields) == 3 else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--planned-state-root", required=True, type=Path)
    parser.add_argument("--private-receipt", type=Path)
    args = parser.parse_args()
    try:
        mem = parse_meminfo(Path("/proc/meminfo").read_text())
        report = probe(
            state_root=args.planned_state_root, env=dict(os.environ),
            cpu_count=os.cpu_count() or 0, ram_bytes=mem,
            mount=actual_findmnt, disk=shutil.disk_usage, which=shutil.which,
            host_os=platform.system(), linux_distribution=os_release(),
        )
        if args.private_receipt:
            # Same owner-only exclusive receipt API as existing real-host probe.
            from shark_fresh_host_operations import append_private_receipt
            append_private_receipt(args.private_receipt, report, args.planned_state_root)
        print(json.dumps(report, sort_keys=True))
        return 0 if report["status"] != "BLOCKED" else 3
    except (ReadinessError, OSError, subprocess.SubprocessError):
        print("SHARK_OVH_READINESS_BLOCKED", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
