import unittest
from unittest.mock import patch
from research import collect, score, parse, fetch_public_json, SOURCES
class PublicResearchTests(unittest.TestCase):
 def test_parse_valid_market_quote(self):
  self.assertEqual(parse("capital",{"price":"65000","time":"2026-10-14T12:30:00Z"})["value"],65000.0)
 def test_market_feed_requires_timestamp(self):
  with self.assertRaises(KeyError): parse("capital",{"price":"65000"})
 def test_feed_errors_are_not_success(self):
  r=collect(lambda url,payload: (_ for _ in ()).throw(TimeoutError()))
  self.assertEqual(len(r),5)
  self.assertTrue(all(x["observation_status"]=="UNAVAILABLE" for x in r.values()))
 def test_score_has_no_fabricated_outcome(self):
  self.assertEqual(score({"dry_run":True,"schema_version":1},{}),{})
 def test_valid_previous_to_current_score(self):
  base=lambda n:{"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":{"metric":"btc_usd_price","value":n}}
  outcomes=score({"schema_version":1,"dry_run":False,"feeds":{"capital":base(100)}},{"capital":base(105)})
  self.assertEqual(outcomes["capital"]["absolute_percentage_error"],5.0)
 def test_unallowlisted_endpoint_is_blocked(self):
  with self.assertRaises(ValueError): fetch_public_json("https://example.org/order",None)
if __name__=="__main__": unittest.main()
