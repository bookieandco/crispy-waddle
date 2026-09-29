import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).parent

worker_spec=importlib.util.spec_from_file_location("music_restoration_worker",ROOT/"worker.py")
if worker_spec is None or worker_spec.loader is None:
    raise ImportError("music restoration worker spec unavailable")
worker=importlib.util.module_from_spec(worker_spec)
sys.modules[worker_spec.name]=worker
worker_spec.loader.exec_module(worker)

fetch_spec=importlib.util.spec_from_file_location("music_restoration_source_fetch",ROOT/"source_fetch.py")
if fetch_spec is None or fetch_spec.loader is None:
    raise ImportError("music restoration source fetch spec unavailable")
source_fetch=importlib.util.module_from_spec(fetch_spec)
sys.modules[fetch_spec.name]=source_fetch
fetch_spec.loader.exec_module(source_fetch)

class MusicRestorationWorkerTest(unittest.TestCase):
    def test_receipt_is_deterministic_and_content_bound(self):
        one=worker.receipt_id("music-test",{"b":2,"a":1})
        two=worker.receipt_id("music-test",{"a":1,"b":2})
        three=worker.receipt_id("music-test",{"a":1,"b":3})
        self.assertEqual(one,two)
        self.assertNotEqual(one,three)
        self.assertTrue(one.startswith("music-test:"))

    def test_repair_filter_is_allow_listed(self):
        self.assertIsNone(worker.build_repair_filter("copy",{}))
        self.assertEqual(worker.build_repair_filter("declick",{}),"adeclick")
        self.assertEqual(worker.build_repair_filter("declip",{}),"adeclip")
        self.assertIn("volume=3.000000dB",worker.build_repair_filter("gain",{"gainDb":3}))
        self.assertIn("equalizer=",worker.build_repair_filter("eq",{"frequencyHz":7800,"gainDb":-1.5,"q":1.2}))
        self.assertIn("afftdn=",worker.build_repair_filter("denoise",{"noiseFloorDb":-55}))
        with self.assertRaisesRegex(ValueError,"NOT_ADMITTED"):
            worker.build_repair_filter("shell",{})
        with self.assertRaisesRegex(ValueError,"OUT_OF_RANGE"):
            worker.build_repair_filter("gain",{"gainDb":24})

    def test_probe_binds_dimensions_and_hash(self):
        payload={
            "streams":[{
                "codec_name":"flac",
                "sample_rate":"48000",
                "channels":2,
                "bits_per_sample":24,
                "duration":"2.5",
            }],
            "format":{"duration":"2.5","format_name":"flac"},
        }
        with patch.object(worker.shutil,"which",return_value="/usr/bin/ffprobe"), \
             patch.object(worker.subprocess,"check_output",return_value=json.dumps(payload)):
            receipt=worker.probe_path(Path("/tmp/source.flac"),"artifact-1","a"*64)
        self.assertEqual(receipt["sampleRate"],48000)
        self.assertEqual(receipt["channels"],2)
        self.assertEqual(receipt["sampleCount"],120000)
        self.assertEqual(receipt["sourceSha256"],"a"*64)
        self.assertTrue(receipt["lossless"])
        self.assertTrue(receipt["runtimeReceiptId"].startswith("music-probe:"))

    def test_readiness_fails_closed_when_runtime_missing(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td))
            with patch.object(worker.shutil,"which",return_value=None), \
                 patch.object(worker.importlib.util,"find_spec",return_value=None):
                state=worker.runtime_readiness(config)
        self.assertFalse(state["productionReady"])
        self.assertIn("MUSIC_RESTORATION_FFMPEG_REQUIRED",state["reasons"])
        self.assertIn("MUSIC_RESTORATION_DEMUCS_REQUIRED",state["reasons"])

    def test_readiness_can_pass_with_required_runtime(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cpu")
            with patch.object(worker.shutil,"which",side_effect=lambda name:f"/usr/bin/{name}"), \
                 patch.object(worker.importlib.util,"find_spec",return_value=object()):
                state=worker.runtime_readiness(config)
        self.assertTrue(state["productionReady"])
        self.assertEqual(state["reasons"],[])
        self.assertEqual(state["demucsDevice"],"cpu")

    def test_readiness_requires_cuda_when_explicitly_configured(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td),demucs_device="cuda")
            real_import=__import__
            class TorchStub:
                class cuda:
                    @staticmethod
                    def is_available():
                        return False
            def fake_import(name,*args,**kwargs):
                if name=="torch":
                    return TorchStub
                return real_import(name,*args,**kwargs)
            with patch.object(worker.shutil,"which",side_effect=lambda name:f"/usr/bin/{name}"), \
                 patch.object(worker.importlib.util,"find_spec",return_value=object()), \
                 patch("builtins.__import__",side_effect=fake_import):
                state=worker.runtime_readiness(config)
        self.assertFalse(state["productionReady"])
        self.assertIn("MUSIC_RESTORATION_CUDA_REQUIRED",state["reasons"])

    def test_artifact_path_is_name_and_job_allow_listed(self):
        with tempfile.TemporaryDirectory() as td:
            config=worker.RestorationWorkerConfig(output_dir=Path(td))
            token="a"*24
            directory=Path(td)/f"repair-{token}"
            directory.mkdir()
            output=directory/"output.wav"
            output.write_bytes(b"wav")
            self.assertEqual(worker.artifact_path(config,token,"output.wav"),output)
            self.assertIsNone(worker.artifact_path(config,token,"../../secret"))
            self.assertIsNone(worker.artifact_path(config,"bad","output.wav"))

    def test_source_staging_rejects_unadmitted_host_before_network(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(ValueError,"HOST_NOT_ADMITTED"):
                source_fetch.stage_verified_source(
                    "https://example.com/source.wav",
                    "a"*64,
                    Path(td)/"source.wav",
                    (".supabase.co",),
                )

if __name__=="__main__":
    unittest.main()
