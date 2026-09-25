import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("replacement_worker",Path(__file__).with_name("worker.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

BASE={
 "sourceAssetId":"source-video",
 "replacementAssetId":"character-image",
 "trackingArtifactId":"tracking:a",
 "approvedTrackIds":["track-1"],
 "preserveMotion":True,
 "preserveFacialMotion":True,
 "preserveLighting":True,
 "preserveOrientation":True,
 "environmentMode":"reference-frame",
 "environmentReferenceAssetId":"frame:bg",
 "motionReferenceAssetId":"source-video",
 "sourceDimensions":{"width":1080,"height":1920},
 "replacementDimensions":{"width":1080,"height":1920},
 "aspectRatioPolicy":"strict-match",
 "continuityRef":"character:mary:v1",
}

class Engine:
 def composite(self,request):
  return {"artifactId":"composite:1","compositeEvidenceIds":["motion:ok","background:ok"]}

class Tests(unittest.TestCase):
 def test_preserves_governed_lineage(self):
  out=m.run_composite(Engine(),BASE)
  self.assertEqual(out["trackingArtifactId"],"tracking:a")
  self.assertEqual(out["motionReferenceAssetId"],"source-video")
  self.assertEqual(out["environmentReferenceAssetId"],"frame:bg")
  self.assertEqual(out["environmentMode"],"reference-frame")
  self.assertEqual(out["continuityRef"],"character:mary:v1")

 def test_rejects_motion_source_substitution(self):
  bad={**BASE,"motionReferenceAssetId":"other-video"}
  with self.assertRaisesRegex(ValueError,"source motion lock"):
   m.run_composite(Engine(),bad)

 def test_rejects_missing_environment_reference(self):
  bad={**BASE}
  bad.pop("environmentReferenceAssetId")
  with self.assertRaisesRegex(ValueError,"environmentReferenceAssetId"):
   m.run_composite(Engine(),bad)

 def test_rejects_strict_aspect_ratio_mismatch(self):
  bad={**BASE,"replacementDimensions":{"width":1920,"height":1080}}
  with self.assertRaisesRegex(ValueError,"aspect ratio"):
   m.run_composite(Engine(),bad)

 def test_fit_crop_can_explicitly_admit_different_ratio(self):
  body={**BASE,"replacementDimensions":{"width":1920,"height":1080},"aspectRatioPolicy":"fit-crop"}
  out=m.run_composite(Engine(),body)
  self.assertEqual(out["artifactId"],"composite:1")

if __name__=="__main__":
 unittest.main()
