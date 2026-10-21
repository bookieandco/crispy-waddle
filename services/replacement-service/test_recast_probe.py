import hashlib
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "recast_probe", Path(__file__).with_name("recast_probe.py"))
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RecastProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "admitted"
        self.root.mkdir()
        self.source = self.root / "source.mp4"
        self.source.write_bytes(b"fixture: local file, not actual MP4")
        self.digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.stdout = json.dumps({"format":{"duration":"12.2"},"streams":[
            {"codec_type":"video","width":1080,"height":1920},
            {"codec_type":"audio"},
        ]})
        self.seen = []

    def runner(self, argv, **kwargs):
        self.seen.append((argv,kwargs))
        return subprocess.CompletedProcess(argv, 0, stdout=self.stdout, stderr="")

    def invoke(self, **kwargs):
        args=dict(admitted_media_root=str(self.root),
                  local_source_path=str(self.source),
                  project_id="project:owner",
                  source_asset_id="video:1",
                  expected_sha256=self.digest,
                  runner=self.runner)
        args.update(kwargs)
        return module.probe_local_recast_source(**args)

    def test_bounded_duration_and_evidence_hash(self):
        output=self.invoke()
        self.assertEqual(output["durationSeconds"],12.2)
        self.assertEqual(output["frameHeight"],1920)
        self.assertEqual(output["sourceVideoSha256"],self.digest)
        self.assertEqual(output["measuredBy"],"trusted-local-media-probe")
        self.assertEqual(len(output["evidenceSha256"]),64)
        self.assertEqual(self.seen[0][0][0],"ffprobe")
        self.assertNotIn("shell",self.seen[0][1])
        self.assertEqual(self.seen[0][1]["timeout"],15)

    def test_hash_mismatch_fails_before_probe(self):
        with self.assertRaisesRegex(ValueError,"HASH_MISMATCH"):
            self.invoke(expected_sha256="b"*64)
        self.assertEqual(self.seen,[])

    def test_outside_admitted_root_fails(self):
        outside=Path(self.temp.name)/"outside.mp4"
        outside.write_bytes(b"bad path")
        with self.assertRaisesRegex(ValueError,"PATH_NOT_ADMITTED"):
            self.invoke(local_source_path=str(outside))
        self.assertEqual(self.seen,[])

    def test_missing_video_or_long_clip_fails(self):
        for payload,pattern in [
            ({"format":{"duration":"31"},"streams":[{"codec_type":"video","width":1920,"height":1080}]},"DURATION_OUT_OF_SCOPE"),
            ({"format":{"duration":"10"},"streams":[{"codec_type":"audio"}]},"VIDEO_STREAM_REQUIRED"),
            ({"format":{"duration":"nan"},"streams":[{"codec_type":"video","width":1920,"height":1080}]},"DURATION_OUT_OF_SCOPE"),
            ({"format":{"duration":"5"},"streams":[{"codec_type":"video","width":0,"height":1080}]},"DIMENSIONS_INVALID"),
        ]:
            with self.subTest(pattern=pattern):
                self.stdout=json.dumps(payload)
                with self.assertRaisesRegex(ValueError,pattern):
                    self.invoke()

    def test_bad_decoder_result_fails_closed(self):
        def fail(argv,**kwargs):
            return subprocess.CompletedProcess(argv,1,stdout="",stderr="unsupported")
        with self.assertRaisesRegex(ValueError,"DECODER_FAILED"):
            self.invoke(runner=fail)

if __name__=="__main__":
    unittest.main()
