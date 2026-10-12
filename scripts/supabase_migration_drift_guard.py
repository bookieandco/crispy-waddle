#!/usr/bin/env python3
"""Read-only Supabase migration drift inventory and collision guard.

Never connects to a database or issues migration commands. Remote metadata must
be provided as a JSON file containing a list of {version, name} entries (or a
{"migrations": [...]} wrapper) from an operator-approved read-only export.

Existing duplicate-version debt is pinned to an exact, reviewed baseline.
New or altered duplicate groups block CI; known groups remain REVIEW REQUIRED
and are never treated as proof that either SQL body is applied.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
import sys

MIGRATION_FILE = re.compile(r"^(\d{14})_([a-zA-Z0-9][a-zA-Z0-9_-]*)\.sql$")


def local_inventory(directory: Path) -> tuple[dict[str, list[str]], list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    invalid: list[str] = []
    if not directory.is_dir():
        raise ValueError(f"Migration directory does not exist: {directory}")
    for path in directory.iterdir():
        if path.is_dir() or path.suffix != ".sql":
            continue
        match = MIGRATION_FILE.fullmatch(path.name)
        if match is None:
            invalid.append(path.name)
        else:
            groups[match.group(1)].append(path.name)
    return {key: sorted(value) for key, value in sorted(groups.items())}, sorted(invalid)


def load_baseline(path: Path) -> dict[str, list[str]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    entries = value.get("known_duplicate_versions")
    if not isinstance(entries, dict):
        raise ValueError("Baseline missing known_duplicate_versions object")
    baseline: dict[str, list[str]] = {}
    for version, names in entries.items():
        if not re.fullmatch(r"\d{14}", version):
            raise ValueError(f"Invalid version in baseline: {version}")
        if not isinstance(names, list) or len(names) < 2 or len(set(names)) != len(names):
            raise ValueError(f"Invalid duplicate filename group in baseline: {version}")
        if any(not name.startswith(f"{version}_") or not MIGRATION_FILE.fullmatch(name) for name in names):
            raise ValueError(f"Baseline filenames do not match version: {version}")
        baseline[version] = sorted(names)
    return dict(sorted(baseline.items()))


def load_remote(path: Path) -> list[dict[str, str]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(value, dict):
        value = value.get("migrations")
    if not isinstance(value, list):
        raise ValueError("Remote metadata must be an array or an object with migrations array")
    remote: list[dict[str, str]] = []
    for index, entry in enumerate(value):
        if not isinstance(entry, dict):
            raise ValueError(f"Invalid migration entry at index {index}")
        version, name = entry.get("version"), entry.get("name")
        if not isinstance(version, str) or not re.fullmatch(r"\d{14}", version):
            raise ValueError(f"Invalid remote version at index {index}")
        if not isinstance(name, str) or not name or "/" in name or "\\" in name:
            raise ValueError(f"Invalid remote migration name at index {index}")
        remote.append({"version": version, "name": name})
    return remote


def compare(directory: Path, baseline_path: Path, remote_path: Path | None = None) -> tuple[dict, bool]:
    local, invalid = local_inventory(directory)
    baseline = load_baseline(baseline_path)
    duplicate_groups = {version: names for version, names in local.items() if len(names) > 1}
    new_or_changed = {v: names for v, names in duplicate_groups.items() if baseline.get(v) != names}
    stale_baseline = {v: names for v, names in baseline.items() if duplicate_groups.get(v) != names}
    blocking = bool(invalid or new_or_changed or stale_baseline)
    all_local_names = [name for group in local.values() for name in group]

    report: dict = {
        "mode": "READ_ONLY_MIGRATION_INVENTORY",
        "productionSqlExecuted": False,
        "migrationApplied": False,
        "localSqlFiles": len(all_local_names),
        "distinctLocalVersions": len(local),
        "knownDuplicateVersionGroups": duplicate_groups,
        "newOrChangedDuplicateGroups": new_or_changed,
        "baselineOutOfSync": stale_baseline,
        "invalidMigrationFilenames": invalid,
        "localCollisionGate": "BLOCKED" if blocking else "PASS_WITH_KNOWN_DEBT",
    }

    if remote_path is not None:
        remote = load_remote(remote_path)
        remote_by_version: dict[str, set[str]] = defaultdict(set)
        remote_versions_by_name: dict[str, set[str]] = defaultdict(set)
        for entry in remote:
            remote_by_version[entry["version"]].add(entry["name"])
            remote_versions_by_name[entry["name"]].add(entry["version"])
        local_versions = set(local)
        remote_versions = set(remote_by_version)
        same_name_different_version = []
        for v, filenames in sorted(local.items()):
            for filename in filenames:
                name = filename[len(v) + 1 : -4]
                alternate = sorted(remote_versions_by_name.get(name, set()) - {v})
                if alternate:
                    same_name_different_version.append({
                        "file": filename,
                        "recordedVersions": alternate,
                    })
        version_name_mismatch = [
            {"version": v, "recordedNames": sorted(remote_by_version[v]), "localFiles": local[v]}
            for v in sorted(local_versions & remote_versions)
            if not any(name[len(v) + 1 : -4] in remote_by_version[v] for name in local[v])
        ]
        report["remote"] = {
            "recordedMigrations": len(remote),
            "distinctRecordedVersions": len(remote_versions),
            "recordedVersionsAbsentFromGit": sorted(remote_versions - local_versions),
            "gitVersionsAbsentFromRemote": sorted(local_versions - remote_versions),
            "sameNameDifferentVersion": same_name_different_version,
            "sameVersionDifferentName": version_name_mismatch,
            "duplicateRemoteVersionRecords": sorted(
                v for v in remote_versions if sum(x["version"] == v for x in remote) > 1
            ),
            "gate": "REVIEW_REQUIRED",
            "note": "Version/name comparisons do not prove SQL content equality or unapplied schema. Never auto-run db push/repair.",
        }
    return report, blocking


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--migrations", type=Path, default=Path("supabase/migrations"))
    parser.add_argument("--baseline", type=Path, default=Path("scripts/data/supabase-known-duplicate-migration-versions.json"))
    parser.add_argument("--remote", type=Path, help="Optional redacted read-only Supabase migration metadata JSON")
    args = parser.parse_args(argv)
    try:
        report, blocking = compare(args.migrations, args.baseline, args.remote)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"gate": "BLOCKED", "error": str(exc), "productionSqlExecuted": False}), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 2 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
