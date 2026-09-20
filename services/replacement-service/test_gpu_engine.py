import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location("engine",Path(__file__).with_name("gpu_engine.py"));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
REQ={"sourceAssetId":"s","replacementAssetId":"muppet","trackingArtifactId":"sam2:a","approvedTrackIds":["t"],"preserveMotion":True,"preserveLighting":True}
class Backend:
 def load_masks(self,a,t): return ["mask"]
 def composite(self,*args,**kwargs): return {"frames":"f","temporalConsistency":.95,"edgeQuality":.9,"lightingMatch":.88}
 def persist(self,frames,artifact_id): return artifact_id
class Tests(unittest.TestCase):
 def test_emits_measured_evidence(self):
  out=m.GpuCompositeEngine(Backend()).composite(REQ);self.assertTrue(out["artifactId"].startswith("composite:"));self.assertIn("composite:edge:0.9000",out["compositeEvidenceIds"])
 def test_requires_masks(self):
  class B(Backend):
   def load_masks(self,a,t): return []
  with self.assertRaises(ValueError): m.GpuCompositeEngine(B()).composite(REQ)
 def test_rejects_invalid_metric(self):
  class B(Backend):
   def composite(self,*a,**k): return {"frames":"f","temporalConsistency":2,"edgeQuality":.9,"lightingMatch":.8}
  with self.assertRaises(ValueError): m.GpuCompositeEngine(B()).composite(REQ)
if __name__=="__main__": unittest.main()
