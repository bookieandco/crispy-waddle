import importlib.util
from pathlib import Path
import unittest
BASE=Path(__file__).parent
def load(name):
 s=importlib.util.spec_from_file_location(name,BASE/f"{name}.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
host=load("host")
class Engine:
 def track_video(self,request): return {"artifactId":"a","tracks":[],"segmentationRefs":[],"keypointRefs":[]}
class TestHost(unittest.TestCase):
 def test_health(self): self.assertEqual(host.create_app(Engine())("GET","/health",{})[0],200)
 def test_track(self): self.assertEqual(host.create_app(Engine())("POST","/v1/track",{"sourceAssetId":"v","frameStart":0,"frameEnd":1,"classes":["character"]})[0],200)
 def test_validation_is_400(self): self.assertEqual(host.create_app(Engine())("POST","/v1/track",{})[0],400)
 def test_internal_error_is_redacted(self):
  class Bad:
   def track_video(self,request): raise RuntimeError("/secret/model/path token=abc")
  status,body=host.create_app(Bad())("POST","/v1/track",{"sourceAssetId":"v","frameStart":0,"frameEnd":1,"classes":["character"]})
  self.assertEqual(status,500);self.assertEqual(body,{"error":"tracking_failed"})
if __name__=="__main__": unittest.main()
