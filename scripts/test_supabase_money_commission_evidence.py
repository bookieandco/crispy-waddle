#!/usr/bin/env python3
"""Synthetic-only negative and boundary tests for the offline commissioning auditor."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

MODULE = Path(__file__).with_name("supabase-money-commission-evidence.py")
SPEC = importlib.util.spec_from_file_location("supabase_money_commission", MODULE)
assert SPEC and SPEC.loader
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)
HEAD = "a" * 40
NOW = datetime(2026, 10, 22, 0, 0, tzinfo=timezone.utc)
ISO = NOW.isoformat()
def sha(raw:bytes)->str:
    return hashlib.sha256(raw).hexdigest()
def write(root:Path,path:str,content:bytes|dict|list)->dict:
    dest = root/path
    dest.parent.mkdir(parents=True,exist_ok=True)
    raw=content if isinstance(content,bytes) else json.dumps(content,separators=(",",":")).encode()
    dest.write_bytes(raw)
    return {"path":path,"sha256":sha(raw)}


class CommissionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def stages(self):
        for stage,check_names in gate.SUPABASE_STAGES.items():
            data={
                "stage":stage,"projectRef":gate.PROJECT_REF,
                "sourceType":"AUTHORIZED_REMOTE_READ_ONLY",
                "mainHeadSha":HEAD,"observedAt":ISO,
                "synthetic":False,"canExecute":False,
                "operatorEvidenceId":"synthetic-test-shape:"+stage,
                "checks":{name:{"passed":True,"evidenceId":"test:"+name} for name in check_names},
            }
            write(self.root,"supabase/"+stage+".json",data)

    def restore(self):
        rows=[{"eventId":"event:1","payloadHash":"hash:1","kind":"fill","occurredAt":"2026-10-01T01:00:00Z"},
              {"eventId":"event:2","payloadHash":"hash:2","kind":"mark","occurredAt":"2026-10-01T02:00:00Z"}]
        encrypted=b"fake-encrypted-backup-fixture"
        files={
            "encryptedBackup":write(self.root,"restore/backup.encrypted",encrypted),
            "independentDownloadedBackup":write(self.root,"independent/backup.encrypted",encrypted),
            "originalLedger":write(self.root,"restore/ledger.json",rows),
            "isolatedRestoredLedger":write(self.root,"independent/restored-ledger.json",rows),
        }
        write(self.root,"money/restore.json",{
            "origin":"ORIGINAL_PERSISTENT","synthetic":False,
            "originalPodId":"fixture:old-pod","originalVolumeId":"fixture:volume",
            "sourceOperatorId":"fixture:source-operator","restorerOperatorId":"fixture:other-operator",
            "backupEncryptionEvidenceId":"fixture:restic-proof",
            "independentDriveReadbackId":"fixture:drive-proof","files":files,
        })

    def feeds(self):
        providers=[]
        for asset in ("STOCK","FOREX","METALS","OPTIONS"):
            record={"asset":asset,"sourceMode":"LICENSED_READ_ONLY","synthetic":False,
                "entitlementEvidenceId":"fixture:rights:"+asset,"sampleEvidenceId":"fixture:quote:"+asset,
                "observedAt":(NOW-timedelta(minutes=3)).isoformat(),
                "availableAt":(NOW-timedelta(minutes=2)).isoformat(),
                "receivedAt":(NOW-timedelta(minutes=1)).isoformat(),
                "twoSidedQuoteVerified":True}
            if asset=="METALS":record["priceKind"]="NON_EXECUTABLE_MIDPOINT"
            if asset=="OPTIONS":record.update(adjustedContractEvidence=True,expirySettlementVerified=True)
            providers.append(record)
        write(self.root,"money/feeds.json",{"providers":providers})

    def paper(self):
        rows=[];previous="GENESIS";hashes=[]
        for i,h in enumerate(gate.HORIZONS):
            record={"schemaVersion":"MONEY-FINISH-14-JOURNAL",
                "sequence":i+1,"previousHash":previous,
                "grade":{"predictionId":"paper:prediction:1","horizon":h,
                    "proof":"FORWARD_PAPER_EVIDENCE_ONLY","canExecute":False,
                    "gradedAt":(NOW-timedelta(days=1)).isoformat()}}
            event_hash=sha(json.dumps(record,separators=(",",":"),ensure_ascii=False).encode())
            record["eventHash"]=event_hash;rows.append(record);hashes.append(event_hash)
            previous=event_hash
        lines=b"".join(json.dumps(x,separators=(",",":")).encode()+b"\n" for x in rows)
        files={"journal":write(self.root,"paper/journal.jsonl",lines)}
        cycles=[{"cycleId":"fixture:"+str(i),"completedAt":(NOW-timedelta(hours=3-i)).isoformat(),
                 "journalCount":(i+1)*2,"journalTailHash":hashes[(i+1)*2-1],
                 "realFeedOrigin":"LICENSED_READ_ONLY","independentReadback":True} for i in range(3)]
        write(self.root,"money/paper.json",{
            "synthetic":False,"liveOrdersDisabled":True,
            "persistentHostEvidenceId":"fixture:host",
            "rebootReadbackEvidenceId":"fixture:reboot",
            "files":files,"cycles":cycles
        })

    def all(self):
        self.stages();self.restore();self.feeds();self.paper()

    def check(self):
        return gate.evaluate(self.root,HEAD,NOW)

    def test_empty_directory_blocks_every_phase_and_never_certifies(self):
        result=self.check()
        self.assertEqual(result["stages"]["SUPABASE-DB.2"]["state"],"BLOCKED")
        self.assertEqual(result["stages"]["MONEY-COMMISSION.FINAL"]["state"],"BLOCKED")
        self.assertEqual(result["finalCertification"],"NOT_ISSUED")
        self.assertFalse(result["canAuthorizeLive"])

    def test_complete_fixture_receipts_still_require_independent_review(self):
        self.all()
        result=self.check()
        self.assertEqual(result["stages"]["SUPABASE-CROSS-SYSTEM.9"]["state"],"REVIEW_REQUIRED")
        self.assertEqual(result["stages"]["MONEY-COMMISSION.FINAL"]["state"],"EXTERNAL_REVIEW_REQUIRED")
        self.assertEqual(result["finalCertification"],"NOT_ISSUED")
        self.assertFalse(result["canExecute"])

    def test_database_health_unavailable_stops_downstream(self):
        self.all()
        path=self.root/"supabase/SUPABASE-DB.2.json"
        item=json.loads(path.read_text())
        item["checks"]["not_in_recovery"]["passed"]=False
        write(self.root,"supabase/SUPABASE-DB.2.json",item)
        result=self.check()
        self.assertIn("CHECK_FAILED:not_in_recovery",result["stages"]["SUPABASE-DB.2"]["reasons"])
        self.assertIn("UPSTREAM_STAGE_NOT_CERTIFIED",result["stages"]["MONEY-COMMISSION.FEEDS"]["reasons"])
        self.assertEqual(result["stages"]["MONEY-COMMISSION.FINAL"]["state"],"BLOCKED")

    def test_wrong_project_and_stale_sources_are_rejected(self):
        self.all()
        path=self.root/"supabase/SUPABASE-DB.2.json"
        item=json.loads(path.read_text());item["projectRef"]="another-project"
        item["observedAt"]=(NOW-timedelta(days=8)).isoformat()
        write(self.root,"supabase/SUPABASE-DB.2.json",item)
        reasons=self.check()["stages"]["SUPABASE-DB.2"]["reasons"]
        self.assertIn("WRONG_PROJECT_OR_STAGE",reasons)
        self.assertIn("STALE_OR_FUTURE_RECEIPT",reasons)

    def test_original_restore_file_divergence_is_not_certified(self):
        self.all()
        (self.root/"independent/restored-ledger.json").write_text("[]")
        reasons=self.check()["stages"]["MONEY-COMMISSION.RESTORE"]["reasons"]
        self.assertIn("ACTUAL_FILE_HASH_MISMATCH:isolatedRestoredLedger",reasons)

    def test_symlink_escape_is_forbidden(self):
        self.all()
        path=self.root/"money/restore.json"
        data=json.loads(path.read_text())
        data["files"]["originalLedger"]["path"]="../../etc/passwd"
        write(self.root,"money/restore.json",data)
        self.assertIn("ACTUAL_FILE_UNAVAILABLE:originalLedger",
                      self.check()["stages"]["MONEY-COMMISSION.RESTORE"]["reasons"])

    def test_no_license_or_missing_options_settlement_blocks_feeds(self):
        self.all()
        path=self.root/"money/feeds.json"
        data=json.loads(path.read_text())
        data["providers"][3]["expirySettlementVerified"]=False
        data["providers"][2]["sourceMode"]="SYNTHETIC_FIXTURE"
        write(self.root,"money/feeds.json",data)
        reasons=self.check()["stages"]["MONEY-COMMISSION.FEEDS"]["reasons"]
        self.assertIn("OPTIONS_CONTRACT_COVERAGE_MISSING",reasons)
        self.assertIn("FEED_LICENSE_OR_SOURCE_INVALID:METALS",reasons)

    def test_paper_journal_actual_bytes_must_match_declared_hash(self):
        self.all()
        path=self.root/"paper/journal.jsonl"
        path.write_bytes(path.read_bytes().replace(b'"sequence":2',b'"sequence":22'))
        reasons=self.check()["stages"]["MONEY-COMMISSION.PAPER"]["reasons"]
        self.assertIn("PAPER_JOURNAL_TAMPER_OR_TRUNCATION",reasons)
        self.assertIn("PAPER_JOURNAL_CHAIN_BROKEN",reasons)

    def test_watchdog_repeated_journal_position_blocks_paper(self):
        self.all()
        path=self.root/"money/paper.json"
        data=json.loads(path.read_text())
        data["cycles"][1]["journalCount"]=data["cycles"][0]["journalCount"]
        write(self.root,"money/paper.json",data)
        self.assertIn("PAPER_WATCHDOG_DIVERGED",
                      self.check()["stages"]["MONEY-COMMISSION.PAPER"]["reasons"])


if __name__=="__main__":
    unittest.main()
