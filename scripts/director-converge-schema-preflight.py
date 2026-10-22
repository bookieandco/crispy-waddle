#!/usr/bin/env python3
"""Non-mutating Director .04/.05 migration inventory. No DB/network credentials used."""
from __future__ import annotations
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTOR_STORES = {
    "director_workstation_timelines": "20261003221000_director_durable_workstation_timeline.sql",
    "director_project_inputs": "20261004193000_director_workstation_project_inputs.sql",
    "director_screenplay_ingest_proposals": "20261004210000_director_screenplay_ingest_proposals.sql",
    "director_screenplay_blueprints": "20261004221000_director_screenplay_blueprints.sql",
    "director_watch_jobs": "20261004224500_director_watch_jobs.sql",
    "director_watch_commissioning_receipts": "20261005023000_director_watch_commissioning_receipts.sql",
    "director_project_final_qc_evidence": "20261005020000_director_project_final_qc_evidence.sql",
}
BASELINE_VERSIONS = ("20261003221000", "20261004193000", "20261004210000",
                     "20261004221000", "20261004224500", "20261005020000", "20261005023000")
VERSIONED = re.compile(r"^(\d{14})_[\w-]+\.sql$")

def inventory(migrations: Path, applied: set[str] | None = None) -> dict:
    versions: dict[str, list[str]] = defaultdict(list)
    for file in migrations.glob("*.sql"):
        match = VERSIONED.fullmatch(file.name)
        if match:
            versions[match.group(1)].append(file.name)
    collisions = {k: sorted(v) for k, v in versions.items() if len(v) > 1}
    checks = {}
    for table, filename in DIRECTOR_STORES.items():
        file = migrations / filename
        if not file.exists():
            checks[table] = {"source": filename, "found": False, "rls": False,
                              "denyClient": False, "serviceRoleGrant": False}
            continue
        source = file.read_text().lower()
        checks[table] = {
            "source": filename, "found": True,
            "createsTable": f"create table if not exists public.{table}" in source,
            "rls": f"alter table public.{table} enable row level security" in source,
            "denyClient": bool(re.search(
                rf"revoke all on public\.{table}\s+from\s+public\s*,\s*anon\s*,\s*authenticated", source)),
            "serviceRoleGrant": bool(re.search(
                rf"grant\s+[^;]+\s+on\s+public\.{table}\s+to\s+service_role", source)),
        }
    timeline = (migrations / DIRECTOR_STORES["director_workstation_timelines"])
    rpc = timeline.read_text().lower() if timeline.exists() else ""
    checks["save_director_workstation_timeline_rpc"] = {
        "function": "create or replace function public.save_director_workstation_timeline(" in rpc,
        "membershipCheck": "director_project_memberships" in rpc and "edit_authority_required" in rpc,
        "revisionFence": "director_timeline_stale_revision" in rpc,
        "appendOnlyEvent": "insert into public.director_workstation_timeline_events(" in rpc,
        "serviceRoleOnly": bool(re.search(
            r"grant execute on function public\.save_director_workstation_timeline\([\s\S]*?\)\s+to service_role", rpc)),
    }
    missing = sorted(k for k, v in checks.items() if not all(
        val is True for key, val in v.items() if isinstance(val, bool)))
    pending = sorted(set(BASELINE_VERSIONS) - (applied or set())) if applied is not None else None
    return {
        "authority": "DIRECTOR_SCHEMA_SOURCE_PREFLIGHT_ONLY",
        "modifiesDatabase": False,
        "collidingVersions": collisions,
        "requiredSourceChecks": checks,
        "sourceCheckFailures": missing,
        "appliedHistorySupplied": applied is not None,
        "pendingRequiredVersions": pending,
        "safeForAutomaticReplay": not collisions and not missing and applied is not None,
        "next": ("MANUAL_MIGRATION_VERSION_RECONCILIATION_REQUIRED"
                 if collisions else "ISOLATED_STAGING_AND_RESTORE_PROOF_REQUIRED"),
    }

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--migrations", type=Path, default=ROOT / "supabase/migrations")
    parser.add_argument("--applied-json", type=Path,
                        help="Optional local JSON list of applied migration version strings; never queried from DB")
    args = parser.parse_args()
    applied = None
    if args.applied_json:
        raw = json.loads(args.applied_json.read_text())
        if not isinstance(raw, list) or not all(isinstance(v, str) for v in raw):
            parser.error("--applied-json must be an array of version strings")
        applied = set(raw)
    print(json.dumps(inventory(args.migrations, applied), indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
