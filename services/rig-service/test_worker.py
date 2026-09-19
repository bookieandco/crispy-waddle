import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location("w",Path(__file__).with_name("worker.py"));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class B:
 def animate(self,r):return {"rigAssetId":"rig","animationAssetId":"anim","frameStart":0,"frameEnd":10,"evidenceIds":["motion:.9"]}
BODY={"characterAssetId":"muppet","trackingArtifactId":"sam2:a","approvedTrackIds":["t"],"channels":["body","head"],"continuityRef":"dna"}
class T(unittest.TestCase):
 def test_deterministic_artifact(self):self.assertEqual(m.run_animation(B(),BODY)["artifactId"],m.run_animation(B(),BODY)["artifactId"])
 def test_rejects_channel(self):
  with self.assertRaises(ValueError):m.run_animation(B(),{**BODY,"channels":["wings"]})
if __name__=="__main__":unittest.main()
