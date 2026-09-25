import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("engine",Path(__file__).with_name("gpu_engine.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

REQ={
 "sourceAssetId":"source-video",
 "replacementAssetId":"character-image",
 "trackingArtifactId":"sam2:a",
 "approvedTrackIds":["t"],
 "preserveMotion":True,
 "preserveFacialMotion":True,
 "preserveLighting":True,
 "preserveOrientation":True,
 "environmentMode":"reference-frame",
 "environmentReferenceAssetId":"frame:bg",
 "motionReferenceAssetId":"source-video",
}

class Backend:
 def load_masks(self,a,t): return ["mask"]
 def composite(self,*args,**kwargs):
  return {
   "frames":"f",
   "temporalConsistency":.95,
   "edgeQuality":.9,
   "lightingMatch":.88,
   "motionMatch":.97,
   "facialMotionMatch":.96,
   "orientationMatch":.99,
   "backgroundMatch":.94,
  }
 def persist(self,frames,artifact_id): return artifact_id

class Tests(unittest.TestCase):
 def test_emits_measured_source_driven_evidence(self):
  out=m.GpuCompositeEngine(Backend()).composite(REQ)
  self.assertTrue(out["artifactId"].startswith("composite:"))
  for expected in (
   "composite:edge:0.9000",
   "composite:motion:0.9700",
   "composite:facial-motion:0.9600",
   "composite:orientation:0.9900",
   "composite:background:0.9400",
   "composite:environment-mode:reference-frame",
   "composite:environment-reference:frame:bg",
   "composite:motion-reference:source-video",
  ):
   self.assertIn(expected,out["compositeEvidenceIds"])

 def test_passes_exact_source_driven_controls_to_backend(self):
  class RecordingBackend(Backend):
   def __init__(self): self.kwargs=None
   def composite(self,*args,**kwargs):
    self.kwargs=kwargs
    return super().composite(*args,**kwargs)
  backend=RecordingBackend()
  m.GpuCompositeEngine(backend).composite(REQ)
  self.assertTrue(backend.kwargs["preserve_motion"])
  self.assertTrue(backend.kwargs["preserve_facial_motion"])
  self.assertTrue(backend.kwargs["preserve_orientation"])
  self.assertEqual(backend.kwargs["environment_mode"],"reference-frame")
  self.assertEqual(backend.kwargs["environment_reference_asset_id"],"frame:bg")
  self.assertEqual(backend.kwargs["motion_reference_asset_id"],"source-video")

 def test_requires_masks(self):
  class B(Backend):
   def load_masks(self,a,t): return []
  with self.assertRaises(ValueError): m.GpuCompositeEngine(B()).composite(REQ)

 def test_rejects_missing_motion_metric_when_motion_locked(self):
  class B(Backend):
   def composite(self,*a,**k):
    result=super().composite(*a,**k)
    del result["motionMatch"]
    return result
  with self.assertRaisesRegex(ValueError,"motionMatch"):
   m.GpuCompositeEngine(B()).composite(REQ)

 def test_rejects_missing_facial_motion_metric_when_lip_motion_locked(self):
  class B(Backend):
   def composite(self,*a,**k):
    result=super().composite(*a,**k)
    del result["facialMotionMatch"]
    return result
  with self.assertRaisesRegex(ValueError,"facialMotionMatch"):
   m.GpuCompositeEngine(B()).composite(REQ)

if __name__=="__main__":
 unittest.main()
