import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_human_media_worker",ROOT/"worker.py")
if spec is None or spec.loader is None:
    raise ImportError("Director human-media worker spec unavailable")
worker=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=worker
spec.loader.exec_module(worker)

def sha(char:str)->str:
    return char*64

def request()->dict:
    return {
        "schema":"director.human-media-job.v1",
        "id":"human-media:ugc:lip-sync:1",
        "projectId":"director:ugc:1",
        "engine":"musetalk",
        "task":"lip-sync",
        "inputAssets":[
            {
                "assetId":"asset:video",
                "role":"source-video",
                "mediaType":"video",
                "uri":"https://assets.example/source.mp4",
                "sha256":sha("a"),
                "rightsEvidenceIds":["rights:video"],
            },
            {
                "assetId":"asset:audio",
                "role":"driving-audio",
                "mediaType":"audio",
                "uri":"https://assets.example/audio.m4a",
                "sha256":sha("b"),
                "rightsEvidenceIds":["rights:audio"],
            },
        ],
        "parameters":{},
        "evidenceIds":["ugc-plan:1","voice-sync:1"],
        "sensitiveData":False,
        "allowCloudBurst":True,
        "authority":"DIRECTOR_HUMAN_MEDIA_JOB",
    }

def make_runtime(base:Path)->worker.MuseTalkRuntimeConfig:
    repo=base/"MuseTalk"
    out=base/"out"
    required=[
        "scripts/inference.py",
        "models/musetalkV15/unet.pth",
        "models/musetalkV15/musetalk.json",
        "models/sd-vae/config.json",
        "models/sd-vae/diffusion_pytorch_model.bin",
        "models/whisper/config.json",
        "models/whisper/pytorch_model.bin",
        "models/whisper/preprocessor_config.json",
        "models/dwpose/dw-ll_ucoco_384.pth",
        "models/face-parse-bisent/79999_iter.pth",
        "models/face-parse-bisent/resnet18-5c106cde.pth",
        "musetalk/utils/face_detection/detection/sfd/s3fd.pth",
    ]
    for relative in required:
        path=repo/relative
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(b"x")
    manifest={
        "schemaVersion":worker.SOURCE_MANIFEST_SCHEMA,
        "sourceRevision":worker.PINNED_MUSETALK_CODE_REVISION,
        "modelArtifacts":[
            {
                "id":"musetalk-v15",
                "path":"models/musetalkV15/unet.pth",
                "sha256":sha("1"),
                "licenseEvidenceIds":["license:musetalk:mit","license:musetalk-model:commercial"],
            },
            {
                "id":"whisper-tiny",
                "path":"models/whisper/pytorch_model.bin",
                "sha256":sha("2"),
                "licenseEvidenceIds":["license:whisper:apache-2.0"],
            },
        ],
    }
    manifest_path=repo/"DIRECTOR_RUNTIME_SOURCES.json"
    manifest_path.write_text(json.dumps(manifest))
    return worker.MuseTalkRuntimeConfig(
        repo_dir=repo,
        output_dir=out,
        runtime_instance_id="runpod:pod:human-media",
        image_digest=sha("f"),
        source_revision=worker.PINNED_MUSETALK_CODE_REVISION,
        source_manifest_path=manifest_path,
    )

class MuseTalkWorkerTests(unittest.TestCase):
    def test_accepts_only_governed_musetalk_lipsync(self):
        worker.validate_request(request())
        bad=request()
        bad["task"]="talking-head"
        with self.assertRaisesRegex(ValueError,"ENGINE_TASK_MISMATCH"):
            worker.validate_request(bad)

    def test_rejects_sensitive_cloud_media_and_missing_rights(self):
        sensitive=request()
        sensitive["sensitiveData"]=True
        with self.assertRaisesRegex(ValueError,"SENSITIVE_CLOUD_EXECUTION_FORBIDDEN"):
            worker.validate_request(sensitive)
        no_rights=request()
        no_rights["inputAssets"][0]["rightsEvidenceIds"]=[]
        with self.assertRaisesRegex(ValueError,"ASSET_RIGHTS_REQUIRED"):
            worker.validate_request(no_rights)

    def test_requires_one_visual_and_one_audio(self):
        body=request()
        body["inputAssets"]=body["inputAssets"][:1]
        with self.assertRaisesRegex(ValueError,"EXACT_VISUAL_AND_AUDIO_REQUIRED"):
            worker.validate_request(body)

    def test_rejects_non_https_remote_assets(self):
        body=request()
        body["inputAssets"][0]["uri"]="http://assets.example/source.mp4"
        with self.assertRaisesRegex(ValueError,"ASSET_URI_HTTPS_REQUIRED"):
            worker.validate_request(body)
        local=request()
        local["inputAssets"][0]["uri"]="http://127.0.0.1/source.mp4"
        worker.validate_request(local)

    def test_job_identity_is_idempotent(self):
        first=worker.provider_job_id("idem:1","job:1")
        second=worker.provider_job_id("idem:1","job:1")
        self.assertEqual(first,second)
        self.assertTrue(first.startswith("musetalk-"))

    def test_runtime_health_reports_observed_runtime_and_model_provenance(self):
        with tempfile.TemporaryDirectory() as td:
            config=make_runtime(Path(td))
            with patch.object(worker,"_git_revision",return_value=worker.PINNED_MUSETALK_CODE_REVISION), \
                 patch.object(worker,"_gpu_health",return_value={
                     "vendor":"nvidia","model":"NVIDIA L4","count":1,"vramGiBPerDevice":24.0,
                 }), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"):
                receipt=worker.runtime_health(config)
            self.assertTrue(receipt["productionReady"])
            self.assertEqual(receipt["engine"],"musetalk")
            self.assertEqual(receipt["imageDigest"],sha("f"))
            self.assertEqual(receipt["sourceRevision"],worker.PINNED_MUSETALK_CODE_REVISION)
            self.assertEqual(receipt["modelArtifactSha256s"],[sha("1"),sha("2")])
            self.assertEqual(receipt["authority"],"DIRECTOR_HUMAN_MEDIA_HEALTH")

    def test_runtime_health_fails_closed_on_unresolved_license_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            config=make_runtime(Path(td))
            payload=json.loads(config.source_manifest_path.read_text())
            payload["modelArtifacts"][0]["licenseEvidenceIds"]=["license:s3fd:upstream-evidence-required"]
            config.source_manifest_path.write_text(json.dumps(payload))
            with patch.object(worker,"_git_revision",return_value=worker.PINNED_MUSETALK_CODE_REVISION), \
                 patch.object(worker,"_gpu_health",return_value={
                     "vendor":"nvidia","model":"NVIDIA L4","count":1,"vramGiBPerDevice":24.0,
                 }), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"):
                receipt=worker.runtime_health(config)
            self.assertFalse(receipt["productionReady"])
            self.assertIn("DIRECTOR_MUSETALK_SOURCE_MANIFEST_INVALID",receipt["reasons"])

    def test_runtime_health_fails_closed_on_revision_manifest_or_gpu_drift(self):
        with tempfile.TemporaryDirectory() as td:
            config=make_runtime(Path(td))
            with patch.object(worker,"_git_revision",return_value="0"*40), \
                 patch.object(worker,"_gpu_health",return_value={"vendor":"cpu","count":0}), \
                 patch.object(worker.shutil,"which",return_value="/usr/bin/ffmpeg"):
                receipt=worker.runtime_health(config)
            self.assertFalse(receipt["productionReady"])
            self.assertIn("DIRECTOR_MUSETALK_SOURCE_REVISION_MISMATCH",receipt["reasons"])
            self.assertIn("DIRECTOR_MUSETALK_GPU_BELOW_4GB_OR_UNAVAILABLE",receipt["reasons"])

    def test_cli_is_pinned_to_v15_and_float16(self):
        with tempfile.TemporaryDirectory() as td:
            config=make_runtime(Path(td))
            args=worker.build_cli_arguments(
                request(),
                config,
                Path(td)/"job.yaml",
                Path(td)/"results",
            )
            self.assertEqual(args[:3],[sys.executable,"-m","scripts.inference"])
            self.assertIn("--version",args)
            self.assertEqual(args[args.index("--version")+1],"v15")
            self.assertIn("--use_float16",args)
            self.assertIn(str(config.repo_dir/"models/musetalkV15/unet.pth"),args)

    def test_audio_normalization_uses_16khz_mono_pcm(self):
        with tempfile.TemporaryDirectory() as td:
            source=Path(td)/"input.m4a"
            output=Path(td)/"output.wav"
            source.write_bytes(b"source")
            def fake_run(args,**kwargs):
                self.assertIn("-ar",args)
                self.assertEqual(args[args.index("-ar")+1],"16000")
                self.assertIn("-ac",args)
                self.assertEqual(args[args.index("-ac")+1],"1")
                output.write_bytes(b"wav")
                class Result:
                    returncode=0
                return Result()
            with patch.object(worker.subprocess,"run",side_effect=fake_run):
                worker._convert_audio_to_wav(source,output)
            self.assertTrue(output.is_file())

    def test_ready_receipt_never_claims_quality(self):
        with tempfile.TemporaryDirectory() as td:
            config=make_runtime(Path(td))
            manager=worker.MuseTalkJobManager(config)
            with patch.object(worker,"runtime_health",return_value={
                "imageDigest":sha("f"),
                "modelArtifactSha256s":[sha("1")],
            }):
                receipt=manager._base_receipt(request(),"musetalk-job","ready")
            self.assertFalse(receipt["qualityClaim"])
            self.assertEqual(receipt["authority"],"DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT")

if __name__=="__main__":
    unittest.main()
