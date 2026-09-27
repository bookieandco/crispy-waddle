import importlib.util
import sys
from pathlib import Path
import tempfile
import unittest

root=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_phantom_worker",root/"worker.py")
if spec is None or spec.loader is None:
    raise ImportError("director phantom worker spec unavailable")
worker=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=worker
spec.loader.exec_module(worker)


def request():
    return {
        "requestId":"request:1",
        "projectId":"project:1",
        "purpose":"final-take",
        "model":"phantom-wan-14b",
        "task":"s2v-14B",
        "size":"1280*720",
        "fps":24,
        "frameNum":121,
        "seed":42,
        "prompt":"The locked hero turns toward camera.",
        "references":[{
            "id":"ref:1",
            "role":"character",
            "assetId":"asset:1",
            "uri":"https://signed.example/ref.png",
            "sha256":"a"*64,
            "description":"locked hero reference",
            "evidenceIds":["lock:1"],
        }],
        "sampleSolver":"unipc",
        "sampleSteps":50,
        "imageGuidanceScale":5,
        "textGuidanceScale":7.5,
        "source":{
            "repository":"Phantom-video/Phantom",
            "license":"Apache-2.0",
            "maximumReferenceImages":4,
        },
        "stabilityNotes":[],
        "authority":"DIRECTOR_PHANTOM_REQUEST",
    }


class PhantomWorkerTests(unittest.TestCase):
    def test_request_contract_accepts_supported_final_take(self):
        worker.validate_request(request())

    def test_reference_limit_fails_closed(self):
        body=request()
        body["references"]=body["references"]*5
        with self.assertRaises(ValueError):
            worker.validate_request(body)

    def test_long_single_generation_is_forbidden(self):
        body=request()
        body["frameNum"]=1201
        with self.assertRaises(ValueError):
            worker.validate_request(body)

    def test_job_id_is_idempotent(self):
        first=worker.provider_job_id("idem:1","request:1")
        second=worker.provider_job_id("idem:1","request:1")
        self.assertEqual(first,second)
        self.assertTrue(first.startswith("phantom-"))

    def test_cli_matches_upstream_phantom_arguments(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            config=worker.PhantomRuntimeConfig(
                repo_dir=base/"Phantom",
                wan_ckpt_dir=base/"Wan2.1-T2V-1.3B",
                checkpoint_1_3b=base/"Phantom-Wan-1.3B.pth",
                checkpoint_14b=base/"Phantom-Wan-Models",
                output_dir=base/"out",
                model_version_1_3b="1.3b",
                model_version_14b="14b",
            )
            args=worker.build_cli_arguments(
                request(),config,[base/"ref.png"],base/"out.mp4"
            )
            self.assertIn("--task",args)
            self.assertIn("s2v-14B",args)
            self.assertIn("--ref_image",args)
            self.assertIn(str(base/"ref.png"),args)
            self.assertIn("--base_seed",args)
            self.assertIn("42",args)
            self.assertIn("--save_file",args)

if __name__=="__main__":
    unittest.main()
