import importlib.util
from pathlib import Path
import unittest
s=importlib.util.spec_from_file_location("w",Path(__file__).with_name("worker.py"));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class B:
 def simulate(self,r):return {"simulatedAnimationAssetId":"sim","frameStart":r["frameStart"],"frameEnd":r["frameEnd"],"evidenceIds":["solver:stable"]}
BODY={"characterAssetId":"muppet","rigAssetId":"rig","animationAssetId":"anim","layers":[{"id":"coat","material":"puppet-fabric","attachment":"torso","stiffness":.4,"damping":.6,"gravityScale":1}],"frameStart":0,"frameEnd":20,"continuityRef":"dna"}
class T(unittest.TestCase):
 def test_puppet_fabric(self):self.assertIn("physics-material:coat:puppet-fabric",m.run_simulation(B(),BODY)["evidenceIds"])
 def test_rejects_unbounded_material(self):
  with self.assertRaises(ValueError):m.run_simulation(B(),{**BODY,"layers":[{**BODY["layers"][0],"stiffness":2}]})
if __name__=="__main__":unittest.main()
