import importlib.util
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

root=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_hunyuan_worker",root/"worker.py")
if spec is None or spec.loader is None:
    raise ImportError("director hunyuan worker spec unavailable")
worker=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=worker
spec.loader.exec_module(worker)

def request():
    return {
        "requestId":"request:1",
        "projectId":"project:1",
        "model":"hunyuan-video-1.5-480p-i2v-step-distilled",
        "mode":"i2v",
        "prompt":"A locked hero turns toward camera.",
        "negativePrompt":"",
        "reference":{
            "assetId":"asset:hero",
            "uri":"https://signed.example/hero.png",
            "sha256":"a"*64,
            "semanticLabel":"locked hero first frame",
            "evidenceIds":["cast:hero"],
        },
        "resolution":"480p",
        "aspectRatio":"16:9",
        "videoLength":121,
        "seed":42,
        "numInferenceSteps":12,
        "cfgDistilled":True,
        "enableStepDistill":True,
        "enableSuperResolution":True,
        "rewritePrompt":False,
        "offloading":True,
        "groupOffloading":True,
        "overlapGroupOffloading":False,
        "source":{
            "repository":"Tencent-Hunyuan/HunyuanVideo-1.5",
            "license":"Tencent-Hunyuan-Community-License",
            "territoryRestricted":True,
            "minimumGpuMemoryGb":14,
        },
        "authority":"DIRECTOR_HUNYUAN_VIDEO_15_REQUEST",
    }

class HunyuanWorkerTests(unittest.TestCase):
    def test_request_contract_accepts_supported_i2v(self):
        worker.validate_request(request())

    def test_step_distill_requires_supported_step_count(self):
        body=request()
        body["numInferenceSteps"]=20
        with self.assertRaises(ValueError):
            worker.validate_request(body)

    def test_t2v_rejects_reference(self):
        body=request()
        body.update({
            "model":"hunyuan-video-1.5-480p-t2v",
            "mode":"t2v",
            "enableStepDistill":False,
            "cfgDistilled":False,
            "numInferenceSteps":50,
        })
        with self.assertRaises(ValueError):
            worker.validate_request(body)

    def test_job_id_is_idempotent(self):
        first=worker.provider_job_id("idem:1","request:1")
        second=worker.provider_job_id("idem:1","request:1")
        self.assertEqual(first,second)
        self.assertTrue(first.startswith("hunyuan-"))

    def test_readiness_requires_license_territory_checkpoint_and_gpu(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            repo=base/"repo"
            model=base/"model"
            out=base/"out"
            repo.mkdir()
            model.mkdir()
            (repo/"generate.py").write_text("print('ok')")
            (model/"transformer").mkdir()
            (model/"text_encoder").mkdir()
            (model/"vision_encoder").mkdir()
            config=worker.HunyuanRuntimeConfig(
                repo_dir=repo,
                model_path=model,
                output_dir=out,
                model_version="1.5",
                license_acknowledged=True,
                territory_acknowledged=True,
            )
            with patch.object(worker,"_gpu_memory_mb",return_value=[24576]):
                ready=worker.runtime_readiness(config)
            self.assertTrue(ready["productionReady"])
            self.assertEqual(ready["reasons"],[])

    def test_probe_duration_uses_ffprobe_output(self):
        with patch.object(worker.subprocess,"check_output",return_value="5.041667\n"):
            duration=worker._probe_duration_seconds(Path("/tmp/output.mp4"))
        self.assertAlmostEqual(duration,5.041667)

    def test_cli_matches_upstream_generate_surface(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            config=worker.HunyuanRuntimeConfig(
                repo_dir=base/"repo",
                model_path=base/"model",
                output_dir=base/"out",
                model_version="1.5",
                license_acknowledged=True,
                territory_acknowledged=True,
            )
            args=worker.build_cli_arguments(
                request(),config,base/"ref.png",base/"output.mp4"
            )
            self.assertIn("--resolution",args)
            self.assertIn("480p",args)
            self.assertIn("--image_path",args)
            self.assertIn(str(base/"ref.png"),args)
            self.assertIn("--enable_step_distill",args)
            self.assertIn("true",args)
            self.assertIn("--video_length",args)
            self.assertIn("121",args)

if __name__=="__main__":
    unittest.main()
