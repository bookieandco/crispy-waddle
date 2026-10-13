import unittest
from report import render
class ReportTests(unittest.TestCase):
 def test_never_calls_software_tests_real_world_success(self):
  report=render({"date":"2026-10-14","preflight":False,"prior_state":"FIRST_DAY_NO_PRIOR_REQUIRED","predictions":[{}],"outcomes":[],"results":[{"lab":"game_qa","status":"PASS"}],"feeds":{"capital":{"observation_status":"UNAVAILABLE","attempts":3}},"record_sha256":"a"*64})
  self.assertIn("not a real-world outcome",report)
  self.assertIn("Trading/publication/payment authority: NONE",report)
  self.assertIn("UNAVAILABLE",report)
if __name__=="__main__": unittest.main()
