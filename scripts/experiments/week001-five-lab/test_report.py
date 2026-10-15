import unittest
from report import render
class ReportTests(unittest.TestCase):
 def test_never_calls_software_tests_real_world_success(self):
  report=render({"date":"2026-10-14","preflight":False,"prior_state":"FIRST_DAY_NO_PRIOR_REQUIRED","predictions":[{}],"outcomes":[],"results":[{"lab":"game_qa","status":"PASS"}],"feeds":{"capital":{"observation_status":"UNAVAILABLE","attempts":3}},"record_sha256":"a"*64})
  self.assertIn("not a real-world outcome",report)
  self.assertIn("Trading/publication/payment authority: NONE",report)
  self.assertIn("UNAVAILABLE",report)
 def test_degraded_status_and_blockers_are_visible(self):
  payload={"date":"2026-10-15","preflight":False,"prior_state":"MISSING_OR_INVALID_PRIOR_DAY",
  "predictions":[],"outcomes":[],"results":[],"feeds":{},
  "health":{"status":"DEGRADED","issues":["MISSING_OR_INVALID_PRIOR_EVIDENCE"]},"record_sha256":"c"*64}
  text=render(payload)
  self.assertIn("Observation completeness: DEGRADED",text)
  self.assertIn("Research blocker: MISSING_OR_INVALID_PRIOR_EVIDENCE",text)
if __name__=="__main__": unittest.main()
