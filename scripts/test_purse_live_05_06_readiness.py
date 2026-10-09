#!/usr/bin/env python3
"""Pure, synthetic-only release-preflight regression tests. No external I/O."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("purse_live_05_06",Path(__file__).with_name("purse-live-05-06-readiness.py"))
assert spec and spec.loader
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
HEAD="a"*40
SOURCE="b"*40

def fixtures():
    gh={"mainSha":HEAD,"prs":{}}
    for n in gate.PRS:
        gh["prs"][str(n)]={"merged":True,"draft":False,"base":"main",
            "headSha":SOURCE,"approvedAtExactHead":True,
            "successfulWorkflowNames":list(gate.REQUIRED_CI_BY_PR[n])}
    receipts={
        "host":{"status":"INDEPENDENT_HOST_REVIEW_REQUIRED","expectedHead":HEAD,
                "finalCertification":"NOT_ISSUED","canExecute":False},
        "database":{"status":"READABLE_BUT_UNCERTIFIED","storageCertified":False,
                    "liveTradingEnabled":False,"blockers":[],"databaseName":"jhadina",
                    "tablePresent":{"money_coffers":True,"money_purse_charters":True}},
        "backup":{"schema":"jhadina.google-homebase.db-backup.v1","scope":"POSTGRES_ONLY",
                  "source_kind":"LOCAL_HOMEBASE_COMPOSE","hosted_supabase_data_covered":False,
                  "restic_encrypted":True,"remote_byte_restore_verified":True,
                  "snapshot_id":"e"*32,"sha256":"f"*64},
        "restore":{"schema":"jhadina.google-homebase.db-restore-drill.v1","source_kind":"LOCAL_HOMEBASE_COMPOSE",
                   "source_snapshot_id":"e"*32,"source_sha256":"f"*64,
                   "isolated_network":True,"production_database_modified":False,
                   "postgres_database_restore_tested":True,
                   "hosted_supabase_data_covered":False,
                   "restored_application_table_count":55},
        "web":{"schema":"money.portable.prod-preflight.v1",
               "status":"PORTABLE_WEB_PROBE_REVIEW_REQUIRED",
               "expectedHeadSha":HEAD,"canExecute":False,"canAuthorizeLive":False},
    }
    return gh,receipts

class PurseLiveReleaseTests(unittest.TestCase):
    def test_complete_synthetic_shape_still_cannot_authorize_live_or_certify(self):
        gh,receipts=fixtures()
        r=gate.evaluate(gh,receipts,HEAD)
        self.assertEqual(r["status"],"INDEPENDENT_OPERATIONS_REVIEW_REQUIRED")
        self.assertFalse(r["canExecute"])
        self.assertFalse(r["canMoveMoney"])
        self.assertFalse(r["canAuthorizeLive"])
        self.assertFalse(r["liveAutonomousTradingCertified"])
        self.assertFalse(r["economicLedgerParityCertified"])
        self.assertFalse(r["productionDeploymentCertified"])

    def test_draft_or_missing_independent_review_blocks(self):
        gh,e=fixtures()
        gh["prs"]["1162"]["draft"]=True
        gh["prs"]["1191"]["approvedAtExactHead"]=False
        r=gate.evaluate(gh,e,HEAD)
        self.assertIn("PR_1162_NOT_SAFELY_MERGED_TO_MAIN",r["reasonCodes"])
        self.assertIn("PR_1191_INDEPENDENT_REVIEW_MISSING",r["reasonCodes"])
        self.assertEqual(r["status"],"BLOCKED")

    def test_stale_main_or_missing_ci_blocks(self):
        gh,e=fixtures()
        gh["mainSha"]="f"*40
        gh["prs"]["1166"]["successfulWorkflowNames"].remove("Money R13B Certification")
        r=gate.evaluate(gh,e,HEAD)
        self.assertIn("MAIN_SHA_MISMATCH_OR_NOT_DEPLOYED",r["reasonCodes"])
        self.assertIn("PR_1166_EXACT_HEAD_CI_MISSING",r["reasonCodes"])

    def test_old_or_synthetic_host_does_not_impersonate_reboot(self):
        gh,e=fixtures()
        e["host"]["status"]="REBOOT_PROOF_PENDING"
        e["host"]["expectedHead"]="f"*40
        r=gate.evaluate(gh,e,HEAD)
        self.assertIn("REAL_POST_REBOOT_DURABLE_HOST_UNPROVEN",r["reasonCodes"])

    def test_fake_backup_or_cross_snapshot_restore_denies(self):
        gh,e=fixtures()
        e["restore"]["source_sha256"]="a"*64
        r=gate.evaluate(gh,e,HEAD)
        self.assertIn("ACTUAL_ENCRYPTED_BACKUP_AND_ISOLATED_RESTORE_UNVERIFIED",r["reasonCodes"])
        gh,e=fixtures()
        e["backup"]["hosted_supabase_data_covered"]=True
        self.assertIn("ACTUAL_ENCRYPTED_BACKUP_AND_ISOLATED_RESTORE_UNVERIFIED",
                      gate.evaluate(gh,e,HEAD)["reasonCodes"])

    def test_database_down_and_volatile_data_denies(self):
        gh,e=fixtures()
        e["database"]["status"]="BLOCKED"
        e["database"]["blockers"]=["DATABASE_UNAVAILABLE_OR_QUERY_REJECTED"]
        r=gate.evaluate(gh,e,HEAD)
        self.assertIn("REAL_PG_SCHEMA_AND_RECOVERY_UNVERIFIED",r["reasonCodes"])
        gh,e=fixtures()
        e["database"]["tablePresent"]["money_coffers"]=False
        self.assertIn("REAL_PG_SCHEMA_AND_RECOVERY_UNVERIFIED",
                      gate.evaluate(gh,e,HEAD)["reasonCodes"])

    def test_no_receipts_are_full_blockers(self):
        gh,_=fixtures()
        r=gate.evaluate(gh,{},HEAD)
        self.assertEqual(r["status"],"BLOCKED")
        self.assertGreaterEqual(len(r["reasonCodes"]),4)

    def test_stale_web_or_wrong_sha_denies(self):
        gh,e=fixtures()
        e["web"]["expectedHeadSha"]=SOURCE
        r=gate.evaluate(gh,e,HEAD)
        self.assertIn("EXACT_SHA_DURABLE_MEMORY_AND_WEB_NOT_VERIFIED",r["reasonCodes"])

    def test_expected_sha_required(self):
        gh,e=fixtures()
        with self.assertRaisesRegex(ValueError,"EXPECTED_SHA_INVALID"):
            gate.evaluate(gh,e,"main")

if __name__=="__main__":
    unittest.main()
