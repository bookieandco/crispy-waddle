import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location("worker",Path(__file__).with_name("worker.py"));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class E:
 def __init__(self,name):self.name=name
 def synchronize(self,r):return {"artifactId":"sync","averageConfidence":.91,"syncEvidenceIds":["timing:.91"]}
B={"videoAssetId":"v","audioAssetId":"a","mode":"lip-sync","tracks":[{"id":"x"}]}
class T(unittest.TestCase):
 def test_prefers_musetalk_for_lip_sync(self):self.assertIn("sync-engine:musetalk",m.VoiceSyncRouter({"musetalk":E("musetalk"),"wav2lip":E("wav2lip")}).synchronize(B)["syncEvidenceIds"])
 def test_falls_back_to_wav2lip(self):self.assertIn("sync-engine:wav2lip",m.VoiceSyncRouter({"wav2lip":E("wav2lip")}).synchronize(B)["syncEvidenceIds"])
 def test_fails_without_engine(self):
  with self.assertRaises(ValueError):m.VoiceSyncRouter({}).synchronize(B)
if __name__=="__main__":unittest.main()
