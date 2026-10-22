"""Offline, non-mutating comparison of the observed Recast schema and repo SQL.

This script NEVER connects to Supabase, applies SQL, marks history, or
recreates a branch. Source snapshots are observations that can go stale.
"""
import json
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
SNAPSHOT=ROOT/"docs/director/RECAST-READONLY-SCHEMA-SNAPSHOT-20261021.json"
WORKSTATION_SQL=ROOT/"supabase/migrations/20261004193000_director_workstation_project_inputs.sql"
REVIEW_SQL=ROOT/"docs/director/RECAST-REVIEW-REGISTRY-PROPOSAL.sql"

def evaluate(snapshot:dict[str,Any],canonical_inputs_sql:str,review_sql:str)->dict[str,Any]:
    blockers=[]
    if snapshot.get("schemaVersion")!="director.recast.live-readonly-observation.v1":
        blockers.append("UNRECOGNIZED_SCHEMA_OBSERVATION")
    tables=snapshot.get("tables")
    if not isinstance(tables,dict):
        tables={}
        blockers.append("SCHEMA_OBSERVATION_MISSING")
    required=("public.jhadina_artifacts","public.director_project_memberships",
        "public.director_project_inputs","public.director_recast_review_receipts")
    for name in required:
        if tables.get(name) is not True:
            blockers.append("MISSING_OR_UNVERIFIED:"+name)
    if "create table if not exists public.director_project_inputs" not in canonical_inputs_sql.lower():
        blockers.append("CANONICAL_WORKSTATION_MIGRATION_MISSING")
    if "create table if not exists public.director_recast_review_receipts" not in review_sql.lower():
        blockers.append("RECAST_REVIEW_SCHEMA_PROPOSAL_MISSING")
    branch=snapshot.get("branch")
    if not isinstance(branch,dict) or branch.get("status")!="ACTIVE_HEALTHY":
        blockers.append("STAGING_BRANCH_NOT_VERIFIED_HEALTHY")
    if not isinstance(branch,dict) or branch.get("failedMigrationSqlConfirmed") is not True:
        blockers.append("EXACT_FAILED_MIGRATION_STATEMENT_NOT_FOUND")
    if snapshot.get("sourceMigrationRecordedAsApplied") is not True:
        blockers.append("WORKSTATION_MIGRATION_NOT_PROVEN_APPLIED")
    return {
        "snapshotDate":snapshot.get("observedDate"),
        "snapshotMayBeStale":True,
        "blockers":blockers,
        "stagingReady":False,
        "automaticMigrationRepairAllowed":False,
        "productionResetAllowed":False,
        "reviewPersistenceEnabled":False,
        "gpuExecutionEnabled":False,
        "nextEvidence":"Find exact failed migration SQL via Supabase Branches > View logs; compare against migration history and live schema.",
    }

def main()->None:
    report=evaluate(json.loads(SNAPSHOT.read_text()),WORKSTATION_SQL.read_text(),REVIEW_SQL.read_text())
    print(json.dumps(report,indent=2))
if __name__=="__main__":
    main()
