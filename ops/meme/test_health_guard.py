import importlib.util
import pathlib
import unittest
from datetime import timedelta
HERE=pathlib.Path(__file__).parent
s=importlib.util.spec_from_file_location("health_guard",HERE/"health_guard.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
obs=m.obs
def minutes_after(text,minutes):
    return (obs.timestamp(text)+timedelta(minutes=minutes)).isoformat().replace("+00:00","Z")
def state():
    s=obs.empty_state()
    t="2026-10-14T04:00:00Z"
    obs.append_event(s,{"type":"CYCLE","observedAt":t,"availableAt":t})
    s["status"]="RUNNING"
    return s

class HealthGuard(unittest.TestCase):
    def test_recent_cycle_green(self):
        r=m.check(state(),"2026-10-14T04:41:00Z")
        self.assertEqual(r["status"],"COLLECTION_HEALTHY_RECENT_CYCLE")
        self.assertFalse(r["canTrade"])
        self.assertFalse(r["alert"])
    def test_stale_collector_red(self):
        r=m.check(state(),"2026-10-14T07:01:00Z")
        self.assertTrue(r["alert"])
        self.assertEqual(r["status"],"COLLECTION_STALE")
    def test_future_forged_clock_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"cycle_timestamp_from_future"):
            m.check(state(),"2026-10-14T03:00:00Z")
    def test_after_cutoff_no_immediate_false_alarm(self):
        r=m.check(state(),"2026-10-20T23:00:00Z")
        self.assertEqual(r["status"],"AWAITING_CUTOFF_LEDGER_AND_FINALIZER")
        self.assertFalse(r["alert"])
    def test_after_grace_must_have_actual_end_and_final(self):
        r=m.check(state(),"2026-10-21T02:00:00Z")
        self.assertTrue(r["alert"])
        self.assertEqual(r["status"],"CUTOFF_NOT_FINALIZED")
        s=state()
        s["status"]="COMPLETED"
        obs.append_event(s,{"type":"END","availableAt":"2026-10-20T23:13:00Z"})
        r=m.check(s,"2026-10-21T02:00:00Z",True)
        self.assertEqual(r["status"],"FINALIZED")
        self.assertFalse(r["alert"])
    def test_cannot_claim_final_without_evidence_file(self):
        s=state()
        s["status"]="COMPLETED"
        obs.append_event(s,{"type":"END","availableAt":"2026-10-20T23:13:00Z"})
        r=m.check(s,"2026-10-21T02:00:00Z",False)
        self.assertTrue(r["alert"])
    def test_tampered_chain_rejected(self):
        s=state()
        s["events"][0]["availableAt"]="2026-10-14T00:00:00Z"
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):
            m.check(s,"2026-10-14T04:41:00Z")
if __name__=="__main__":unittest.main()
