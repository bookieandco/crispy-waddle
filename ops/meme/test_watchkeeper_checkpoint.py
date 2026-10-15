"""WATCHKEEPER.09 hermetic checkpoint, idempotency, tamper and crash-retry checks."""
from __future__ import annotations
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("w09",HERE/"watchkeeper_checkpoint.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
T="2026-10-14T10:00:00Z"
LATER="2026-10-14T10:10:00Z"
def raw_state(n=1,status="RUNNING"):
    state=m.obs.empty_state()
    state["status"]=status
    for i in range(n):
        stamp="2026-10-14T10:%02d:00Z"%i
        m.obs.append_event(state,{"type":"CYCLE","observedAt":stamp,"availableAt":stamp})
    m.obs.audit(state)
    return m.canonical(state)
class CheckpointSafety(unittest.TestCase):
    def test_append_and_local_byte_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            x=m.commit(f,raw_state(), "run-20261014-001",LATER)
            self.assertEqual(x["status"],"LOCAL_CHECKPOINT_COMMITTED")
            self.assertFalse(x["externalArchiveVerified"])
            self.assertEqual(len(m.load(f)),1)
            self.assertEqual(m.audit(f,m.load(f)),x["event"]["hash"])
            self.assertFalse(x["event"]["receipt"]["fullPostgresRestoreVerified"])

    def test_same_run_idempotent_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp);raw=raw_state()
            m.commit(f,raw,"run-20261014-001",LATER)
            res=m.commit(f,raw,"run-20261014-001",LATER)
            self.assertEqual(res["status"],"IDEMPOTENT_REPLAY")
            self.assertEqual(len(m.load(f)),1)

    def test_stale_run_reuse_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            m.commit(f,raw_state(),"run-20261014-001",LATER)
            with self.assertRaisesRegex(ValueError,"run_reuse_conflict"):
                m.commit(f,raw_state(2),"run-20261014-001",LATER)

    def test_replay_same_state_different_run_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            m.commit(f,raw_state(),"run-20261014-001",LATER)
            with self.assertRaisesRegex(ValueError,"repeated_source_head"):
                m.commit(f,raw_state(),"run-20261014-002",LATER)

    def test_monotonic_new_head(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            m.commit(f,raw_state(),"run-20261014-001",LATER)
            m.commit(f,raw_state(2),"run-20261014-002","2026-10-14T10:11:00Z")
            self.assertEqual(len(m.load(f)),2)

    def test_run_time_regression_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            m.commit(f,raw_state(),"run-20261014-001",LATER)
            with self.assertRaisesRegex(ValueError,"time_regression"):
                m.commit(f,raw_state(2),"run-20261014-002","2026-10-14T10:09:00Z")

    def test_corrupted_source_audit_fails(self):
        b=raw_state()
        d=json.loads(b);d["events"][0]["availableAt"]="2026-10-14T11:00:00Z"
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):
            m.construct(m.canonical(d),"run-20261014-001",LATER)

    def test_future_event_refused_even_if_valid_hash(self):
        s=m.obs.empty_state()
        m.obs.append_event(s,{"type":"CYCLE","availableAt":"2026-10-15T12:00:00Z"})
        with self.assertRaisesRegex(ValueError,"future_data"):
            m.construct(m.canonical(s),"run-20261014-001",LATER)

    def test_late_cycle_marks_gap_not_reliability(self):
        d=m.construct(raw_state(),"run-20261014-001","2026-10-14T16:00:00Z")
        self.assertFalse(d["schedulerFreshEnough"])
        self.assertFalse(d["schedulerCoverageCertified"])

    def test_archive_file_byte_flip_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            x=m.commit(f,raw_state(),"run-20261014-001",LATER)["event"]
            path=f/("state-"+x["receipt"]["stateBytesSha256"]+".json")
            b=bytearray(path.read_bytes())
            b[8]^=1
            path.write_bytes(b)
            with self.assertRaisesRegex(ValueError,"restore_bytes_mismatch"):
                m.load(f)

    def test_journal_hash_flip_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            m.commit(f,raw_state(),"run-20261014-001",LATER)
            ev=json.loads((f/"journal.jsonl").read_text())
            ev["receipt"]["canExecute"]=True
            (f/"journal.jsonl").write_text(json.dumps(ev)+"\n")
            with self.assertRaisesRegex(ValueError,"hash_tampered"):
                m.load(f)

    def test_self_consistent_false_certification_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp);e=m.commit(f,raw_state(),"run-20261014-001",LATER)["event"]
            payload=copy.deepcopy(e)
            payload["receipt"]["externalAnchorVerified"]=True
            payload["hash"]=m.digest({k:payload[k] for k in ("seq","prevHash","receipt")})
            (f/"journal.jsonl").write_text(json.dumps(payload)+"\n")
            with self.assertRaisesRegex(ValueError,"false_certification"):
                m.load(f)

    def test_no_symlink_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=pathlib.Path(tmp);actual=base/"actual";actual.mkdir()
            alias=base/"alias";alias.symlink_to(actual)
            with self.assertRaisesRegex(ValueError,"archive_symlink"):
                m.commit(alias,raw_state(),"run-20261014-001",LATER)

    def test_no_symlink_journal(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp);s=f/"sink";s.write_text("")
            (f/"journal.jsonl").symlink_to(s)
            with self.assertRaisesRegex(ValueError,"symlink"):
                m.commit(f,raw_state(),"run-20261014-001",LATER)

    def test_invalid_run_id_and_prestart_refused(self):
        with self.assertRaisesRegex(ValueError,"run_id_invalid"):
            m.construct(raw_state(),"../bad","2026-10-14T10:10:00Z")
        with self.assertRaisesRegex(ValueError,"preexperiment"):
            m.construct(raw_state(),"run-20261014-001","2026-10-01T10:10:00Z")

    def test_no_external_notarization_after_local_restore(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp)
            m.commit(f,raw_state(),"run-20261014-001",LATER)
            r=m.load(f)[0]["receipt"]
            self.assertFalse(r["independentArchiveVerified"])
            self.assertFalse(r["externalAnchorVerified"])
            self.assertFalse(r["canAuthorizeLive"])
if __name__=="__main__":
    unittest.main()
