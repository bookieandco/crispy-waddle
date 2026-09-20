import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location("w",Path(__file__).with_name("worker.py"));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
B={"sourceAssetId":"s","compositeAssetId":"c","voiceSyncArtifactId":"v","animationAssetId":"a","physicsAssetId":"p","frameStart":0,"frameEnd":30,"continuityRef":"dna"}
class R:
 def render(self,r):return {"mediaAssetId":"final","frameStart":0,"frameEnd":30,"evidenceIds":["gpu:ok"]}
class T(unittest.TestCase):
 def test_complete_lineage(self):self.assertIn("render-lineage:complete",m.run_render(R(),B)["evidenceIds"])
 def test_requires_all_stages(self):
  with self.assertRaises(ValueError):m.run_render(R(),{**B,"physicsAssetId":""})
if __name__=="__main__":unittest.main()
