import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec=importlib.util.spec_from_file_location(
    "recast_preview_acceptance", Path(__file__).with_name("recast_preview_acceptance.py"))
assert spec is not None and spec.loader is not None
acceptance=importlib.util.module_from_spec(spec)
spec.loader.exec_module(acceptance)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

class RecastLocalPreviewAcceptanceTest(unittest.TestCase):
    def setUp(self):
        t=tempfile.TemporaryDirectory()
        self.addCleanup(t.cleanup)
        self.root=Path(t.name)
        self.source=self.root/"original.mp4"
        self.preview=self.root/"recast.mp4"
        self.source.write_bytes(b"fixture original, not actual MP4")
        self.preview.write_bytes(b"fixture recast, not actual MP4")
        self.preview_duration=10.1
        self.preview_width=1080
        self.preview_audio=True
        self.calls=0

    def runner(self,argv,**kwargs):
        self.calls+=1
        preview=argv[-1] == str(self.preview)
        body={"format":{"duration":str(self.preview_duration if preview else 10.0)},
              "streams":[{"codec_type":"video","width":self.preview_width if preview else 1080,
                          "height":1920}]}
        if not preview or self.preview_audio:
            body["streams"].append({"codec_type":"audio"})
        return subprocess.CompletedProcess(argv,0,stdout=json.dumps(body),stderr="")

    def run_probe(self,**changes):
        args=dict(admitted_media_root=str(self.root),
                  source_path=str(self.source),preview_path=str(self.preview),
                  source_sha256=digest(self.source),preview_sha256=digest(self.preview),
                  project_id="proj:1",source_asset_id="original:1",preview_asset_id="recast:1",
                  runner=self.runner)
        args.update(changes)
        return acceptance.inspect_recast_local_pair(**args)

    def test_metadata_aligned_but_no_automatic_identity_or_lipsync_certificate(self):
        report=self.run_probe()
        self.assertTrue(report["metadataConformant"])
        self.assertFalse(report["visualIdentityMeasured"])
        self.assertFalse(report["lipSyncMeasured"])
        self.assertFalse(report["ownerApproved"])
        self.assertFalse(report["renderExecuted"])
        self.assertEqual(report["publicationAuthority"],"NONE")
        self.assertEqual(self.calls,2)

    def test_video_duration_dimensions_audio_violations(self):
        self.preview_duration=11
        self.assertIn("DIRECTOR_RECAST_LOCAL_CLIP_DURATION_MISMATCH",
                      self.run_probe()["blockers"])
        self.preview_duration=10
        self.preview_width=720
        self.assertIn("DIRECTOR_RECAST_LOCAL_FRAME_DIMENSIONS_MISMATCH",
                      self.run_probe()["blockers"])
        self.preview_width=1080
        self.preview_audio=False
        self.assertIn("DIRECTOR_RECAST_LOCAL_PREVIEW_AUDIO_MISSING",
                      self.run_probe()["blockers"])

    def test_reused_asset_identity_and_changed_sha_do_not_pass(self):
        with self.assertRaisesRegex(ValueError,"IDENTITY_MUST_BE_DISTINCT"):
            self.run_probe(preview_asset_id="original:1")
        self.assertEqual(self.calls,0)
        with self.assertRaisesRegex(ValueError,"SOURCE_REUSE_FORBIDDEN"):
            self.run_probe(preview_path=str(self.source))
        with self.assertRaisesRegex(ValueError,"SOURCE_HASH_MISMATCH"):
            self.run_probe(preview_sha256="a"*64)

if __name__=="__main__":
    unittest.main()
