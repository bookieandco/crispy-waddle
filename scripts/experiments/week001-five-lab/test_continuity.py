import datetime as dt
import json
import pathlib
import tempfile
import unittest
from continuity import FIRST_DATE,FIRST_RECORD_SHA256,FIRST_PREDICTION_SHA256,verify_genesis,prior_research_date_valid
from runner import read_prior,canonical,digest
class OriginalArtifactAnchorTests(unittest.TestCase):
 def sample(self):
  return {"record_sha256":FIRST_RECORD_SHA256,
          "date":FIRST_DATE.isoformat(),"preflight":False,"dry_run":False,
          "settlement":False,"financial_authority":"NONE","publication_authority":"NONE",
          "paid_services_authorized":False,
          "predictions":[{"source":s,"prediction_sha256":v,"execute_authority":False,
                          "publication_authority":False} for s,v in FIRST_PREDICTION_SHA256.items()]}
 def test_original_oct14_record_anchor_matches_six_signatures(self):
  self.assertEqual(len(FIRST_PREDICTION_SHA256),6)
  self.assertTrue(verify_genesis(self.sample()))
 def test_modified_record_identity_is_rejected(self):
  payload=self.sample()
  payload["record_sha256"]="0"*64
  self.assertFalse(verify_genesis(payload))
  payload=self.sample()
  payload["predictions"][0]["prediction_sha256"]="f"*64
  self.assertFalse(verify_genesis(payload))
 def test_previous_day_must_be_live_scheduled_nonsettlement(self):
  prior=self.sample()
  self.assertTrue(prior_research_date_valid(prior,FIRST_DATE))
  prior["preflight"]=True
  self.assertFalse(prior_research_date_valid(prior,FIRST_DATE))
  prior["preflight"]=False
  prior["settlement"]=True
  self.assertFalse(prior_research_date_valid(prior,FIRST_DATE))
 def test_local_rehashed_synthetic_day_one_cannot_pass_scheduled_anchor(self):
  payload=self.sample()
  payload["record_sha256"]=digest(canonical({k:v for k,v in payload.items() if k!="record_sha256"}))
  with tempfile.TemporaryDirectory() as temp:
   path=pathlib.Path(temp)/"evidence.json"
   path.write_text(json.dumps(payload))
   self.assertIsNotNone(read_prior(str(path),dt.date(2026,10,15),anchored=False))
   self.assertIsNone(read_prior(str(path),dt.date(2026,10,15),anchored=True))
if __name__=="__main__":unittest.main()
