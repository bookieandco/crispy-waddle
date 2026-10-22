import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("recast_replay",ROOT/"scripts/director-recast-replay-forensics.py")
assert spec is not None and spec.loader is not None
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
snapshot=json.loads((ROOT/"docs/director/RECAST-READONLY-SCHEMA-SNAPSHOT-20261021.json").read_text())
inputs=(ROOT/"supabase/migrations/20261004193000_director_workstation_project_inputs.sql").read_text()
review=(ROOT/"docs/director/RECAST-REVIEW-REGISTRY-PROPOSAL.sql").read_text()

class ReplayForensics(unittest.TestCase):
    def test_confirmed_readonly_drift_stays_blocked(self):
        result=mod.evaluate(snapshot,inputs,review)
        self.assertFalse(result["stagingReady"])
        self.assertFalse(result["automaticMigrationRepairAllowed"])
        self.assertIn("MISSING_OR_UNVERIFIED:public.director_project_inputs",result["blockers"])
        self.assertIn("EXACT_FAILED_MIGRATION_STATEMENT_NOT_FOUND",result["blockers"])
    def test_stale_snapshot_cannot_generate_a_live_clearance(self):
        confirmed=json.loads(json.dumps(snapshot))
        for k in confirmed["tables"]:
            confirmed["tables"][k]=True
        confirmed["branch"]={"status":"ACTIVE_HEALTHY","failedMigrationSqlConfirmed":True}
        confirmed["sourceMigrationRecordedAsApplied"]=True
        result=mod.evaluate(confirmed,inputs,review)
        self.assertFalse(result["stagingReady"])
        self.assertTrue(result["snapshotMayBeStale"])
        self.assertFalse(result["reviewPersistenceEnabled"])
    def test_missing_canonical_migration_is_detected(self):
        result=mod.evaluate(snapshot,"-- missing Workstation migration",review)
        self.assertIn("CANONICAL_WORKSTATION_MIGRATION_MISSING",result["blockers"])

if __name__=="__main__":
    unittest.main()
