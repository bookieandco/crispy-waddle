import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location("engines",Path(__file__).with_name("engines.py"));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def resolve(x):return "/sandbox/"+x
def ok(**k):return {"artifactId":"out","averageConfidence":.9,"syncEvidenceIds":["timing:.9"]}
class T(unittest.TestCase):
 def test_musetalk_resolves_bounded_assets(self):self.assertIn("runtime:musetalk",m.MuseTalkEngine(resolve,ok).synchronize({"videoAssetId":"v","audioAssetId":"a","tracks":[]})["syncEvidenceIds"])
 def test_wav2lip_rejects_bad_confidence(self):
  with self.assertRaises(ValueError):m.Wav2LipEngine(resolve,lambda **k:{"artifactId":"x","averageConfidence":2,"syncEvidenceIds":[]}).synchronize({"videoAssetId":"v","audioAssetId":"a","tracks":[]})
 def test_rhubarb_rejects_visual_mode(self):
  with self.assertRaises(ValueError):m.RhubarbEngine(resolve,ok).synchronize({"audioAssetId":"a","mode":"lip-sync","tracks":[]})
if __name__=="__main__":unittest.main()
