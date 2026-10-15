import json
import pathlib
import tempfile
import unittest
from archive import make_archive,verify_drive_bytes
from learning import sha
from release_gate import run
from finish_cli import main as cli_main
from unittest.mock import patch
import sys
class RemoteRestoreTests(unittest.TestCase):
 def create_zip(self,root):
  source=pathlib.Path(root)/"source";source.mkdir()
  record={"schema_version":1,"date":"2026-10-15","preflight":True,
          "financial_authority":"NONE","results":[]}
  record["record_sha256"]=sha(record)
  (source/"evidence.json").write_text(json.dumps(record))
  return make_archive(source,pathlib.Path(root)/"a.zip")
 def test_verified_remote_same_bytes_restores(self):
  with tempfile.TemporaryDirectory() as folder:
   self.create_zip(folder)
   zipfile=pathlib.Path(folder)/"a.zip"
   self.assertTrue(verify_drive_bytes(zipfile.read_bytes(),zipfile))
 def test_remote_body_corruption_is_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   self.create_zip(folder)
   zipfile=pathlib.Path(folder)/"a.zip"
   with self.assertRaises(ValueError):
    verify_drive_bytes(zipfile.read_bytes()+b'altered',zipfile)
 def test_cutoff_remote_restore_missing_is_still_incomplete(self):
  with tempfile.TemporaryDirectory() as folder:
   out=run(folder)
   case=next(x for x in out["milestones"] if x["id"]=="LAB-FINISH.03")
   self.assertEqual(case["status"],"GOOGLE_DRIVE_AUTH_OR_RESTORE_PENDING")
 def test_review_rejects_unsealed_data(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/"evidence.json"
   path.write_text(json.dumps({"record_sha256":"x"*64}))
   args=["finish_cli.py","--evidence",str(path),"--output",folder]
   with patch.object(sys,"argv",args):
    self.assertEqual(cli_main(),1)
if __name__=="__main__":unittest.main()
