import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("worker",Path(__file__).with_name("worker.py"))
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class Engine:
    def track_video(self,request):
        return {"artifactId":"sam2:a","tracks":[{"trackId":"t","class":"character","instanceId":"c","frameStart":0,"frameEnd":5,"annotations":[],"confidence":.9,"approved":True}],"segmentationRefs":["mask"],"keypointRefs":[]}

class TestWorker(unittest.TestCase):
    def test_model_cannot_self_approve(self):
        out=worker.run_sam2(Engine(),{"sourceAssetId":"video","frameStart":0,"frameEnd":5,"classes":["character"]})
        self.assertFalse(out["tracks"][0]["approved"]);self.assertEqual(out["tracks"][0]["source"],"model")
    def test_rejects_unbounded_request(self):
        with self.assertRaises(ValueError): worker.parse_request({"sourceAssetId":"v","frameStart":5,"frameEnd":1,"classes":["character"]})
    def test_rejects_unrequested_output_class(self):
        class Bad:
            def track_video(self,request): return {"artifactId":"x","tracks":[{"class":"prop","frameStart":0,"frameEnd":5}]}
        with self.assertRaises(ValueError): worker.run_sam2(Bad(),{"sourceAssetId":"v","frameStart":0,"frameEnd":5,"classes":["character"]})
if __name__=="__main__": unittest.main()
