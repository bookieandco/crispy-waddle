"""Finalized state is not automatically certified without persisted report."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("shark_cutoff_proof_test", HERE / "cutoff_proof.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
obs = m.obs
NOW = "2026-10-20T23:15:00Z"
END_AT = "2026-10-20T22:55:00Z"


def completed():
    s = obs.empty_state()
    obs.append_event(s, {
        "type": "CYCLE", "availableAt": "2026-10-20T22:19:00Z",
        "observedAt": "2026-10-20T22:19:00Z",
    })
    obs.append_event(s, {
        "type": "END", "availableAt": END_AT,
        "observedAt": END_AT,
        "reason": "SEVEN_DAY_CUTOFF_NO_MORE_POLLING",
    })
    s["status"] = "COMPLETED"
    return s


def report(s):
    return m.final.render(m.final.build(s, NOW))


class CutoffProof(unittest.TestCase):
    def test_matching_persisted_final_allows_only_disable(self):
        s = completed()
        proof = m.verify(s, report(s), NOW)
        self.assertTrue(proof["canDisableWorkflow"])
        for name in ("canSign", "canBroadcast", "canTrade", "canLaunch"):
            self.assertIs(proof[name], False)
        self.assertEqual(proof["ledgerHead"], s["lastDigest"])

    def test_before_real_cutoff_refuses(self):
        s = completed()
        with self.assertRaisesRegex(ValueError, "not_reached"):
            m.verify(s, report(s), "2026-10-20T22:49:59Z")

    def test_missing_or_stale_report_refuses_even_with_end(self):
        s = completed()
        with self.assertRaisesRegex(ValueError, "missing_persisted_report"):
            m.verify(s, "", NOW)
        with self.assertRaisesRegex(ValueError, "not_matching_ledger"):
            m.verify(s, report(s).replace(s["lastDigest"], "0" * 64), NOW)

    def test_early_duplicate_and_future_end_fail_closed(self):
        for end_at in ("2026-10-20T22:49:00Z", "2026-10-21T10:00:00Z"):
            s = obs.empty_state()
            obs.append_event(s, {"type": "END", "observedAt": end_at,
                                 "availableAt": end_at})
            s["status"] = "COMPLETED"
            with self.assertRaisesRegex(ValueError, "invalid_end_time"):
                m.verify(s, "placeholder", NOW)
        s = completed()
        obs.append_event(s, {"type": "END", "observedAt": END_AT,
                             "availableAt": END_AT})
        with self.assertRaisesRegex(ValueError, "exactly_one_end"):
            m.verify(s, "placeholder", NOW)

    def test_uncompleted_and_corrupt_chain_refuse(self):
        s = completed()
        s["status"] = "RUNNING"
        with self.assertRaisesRegex(ValueError, "uncompleted"):
            m.verify(s, "placeholder", NOW)
        s = completed()
        tampered = copy.deepcopy(s)
        tampered["events"][0]["availableAt"] = "2026-10-20T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "event_digest_invalid"):
            m.verify(tampered, "placeholder", NOW)


if __name__ == "__main__":
    unittest.main()
