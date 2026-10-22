#!/usr/bin/env python3
"""DIRECTOR-LIVE.20/.21: source+ledger comparison only. NEVER applies live SQL."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase/migrations"
ORDER = (
    "20261003221000_director_durable_workstation_timeline.sql",
    "20261004193000_director_workstation_project_inputs.sql",
    "20261004210000_director_screenplay_ingest_proposals.sql",
    "20261004221000_director_screenplay_blueprints.sql",
    "20261004224500_director_watch_jobs.sql",
    "20261004231500_director_watch_sources_idle_scheduler.sql",
    "20261005000500_director_take_qc_watch_jobs.sql",
    "20261005020000_director_project_final_qc_evidence.sql",
    "20261005023000_director_watch_commissioning_receipts.sql",
    "20261005024500_director_business_canary_receipts.sql",
)

def audit(directory: Path, applied: list[str] | None = None) -> dict:
    if applied is not None and (not isinstance(applied, list) or
      not all(isinstance(x, str) and re.fullmatch(r"\d{14}",x) for x in applied)):
        raise ValueError("applied history must contain 14-digit migration version strings")
    versions: dict[str,list[str]] = defaultdict(list)
    for p in sorted(directory.glob("*.sql")):
        m=re.match(r"^(\d{14})_[\w-]+\.sql$",p.name)
        if m: versions[m.group(1)].append(p.name)
    collisions={v:fs for v,fs in sorted(versions.items()) if len(fs)>1}
    manifest=[]
    for name in ORDER:
        f=directory/name
        if not f.is_file(): raise FileNotFoundError(name)
        raw=f.read_bytes()
        version=name[:14]
        manifest.append({
            "name":name, "version":version, "sha256":hashlib.sha256(raw).hexdigest(),
            "sourceCollision":version in collisions,
            "sameVersionAlternatives":collisions.get(version,[]),
            "remoteHistoryStatus":("UNKNOWN" if applied is None else
              "VERSION_RECORDED_PAYLOAD_UNVERIFIED" if version in applied else "VERSION_NOT_RECORDED"),
        })
    return {
        "authority":"READ_ONLY_MIGRATION_RECONCILIATION", "schemaChangesAuthorized":False,
        "automaticReplayAllowed":False, "historyProvided":applied is not None,
        "totalRemoteVersionRecords":len(applied) if applied is not None else None,
        "migrationSources":manifest, "allTimestampCollisions":collisions,
        "versionCollisionCount":len(collisions),
        "sourceVersionsMissingFromRemote":[x["version"] for x in manifest
            if x["remoteHistoryStatus"]=="VERSION_NOT_RECORDED"],
        "liveRestoreVerified":False,
        "productionRlsVerified":False,
        "next": "REVIEW_INDEPENDENT_DB_AUTH_STORAGE_RESTORE_AND_MAP_EVERY_COLLISION_THEN_SEPARATE_PRODUCTION_DDL_APPROVAL",
        "noGo":["NO_DB_PUSH","NO_MIGRATION_REPAIR","NO_PRODUCTION_DDL",
                "NO_AUTOMATIC_VERSION_RENAME","NO_RESET","NO_RELEASE_OR_PUBLISH"],
    }

def main() -> None:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--migrations",type=Path,default=MIGRATIONS)
    ap.add_argument("--applied-json",type=Path,
                    help="read-only locally supplied list from the live migration ledger")
    ap.add_argument("--output",type=Path,
                    help="write a source-only audit receipt; no access to Supabase")
    args=ap.parse_args()
    applied=None
    if args.applied_json: applied=json.loads(args.applied_json.read_text())
    result=audit(args.migrations,applied)
    output=json.dumps(result,indent=2,sort_keys=True)+"\n"
    if args.output:
        args.output.write_text(output)
    else: print(output,end="")

if __name__=="__main__":main()
