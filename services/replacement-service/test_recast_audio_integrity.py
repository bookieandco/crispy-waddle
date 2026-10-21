import hashlib
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec=importlib.util.spec_from_file_location(
    "recast_audio_integrity",Path(__file__).with_name("recast_audio_integrity.py"))
assert spec is not None and spec.loader is not None
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RecastAudioIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.source=self.root/"source.mp4"
        self.preview=self.root/"preview.mp4"
        self.source.write_bytes(b"original mp4 fixture")
        self.preview.write_bytes(b"preview mp4 fixture")
        self.pcm_original=b"pcm source"*3000
        self.pcm_preview=self.pcm_original
        self.calls=0
    def run_fingerprint(self,**overrides):
        def runner(argv,**kwargs):
            self.calls+=1
            self.assertEqual(argv[0],"ffmpeg")
            self.assertEqual(kwargs.get("timeout"),30)
            self.assertNotIn("shell",kwargs)
            pcm=self.pcm_preview if argv[argv.index("-i")+1]==str(self.preview) else self.pcm_original
            return subprocess.CompletedProcess(argv,0,stdout=pcm,stderr=b"")
        data=dict(admitted_media_root=str(self.root),
                  original_video_path=str(self.source),preview_video_path=str(self.preview),
                  original_sha256=hashlib.sha256(self.source.read_bytes()).hexdigest(),
                  preview_sha256=hashlib.sha256(self.preview.read_bytes()).hexdigest(),runner=runner)
        data.update(overrides)
        return mod.compare_decoded_original_audio(**data)
    def test_exact_original_audio_without_approval(self):
        r=self.run_fingerprint()
        self.assertTrue(r["decodedAudioExactlyPreserved"])
        self.assertFalse(r["lipSyncVerified"])
        self.assertEqual(r["publicationAuthority"],"NONE")
        self.assertEqual(self.calls,2)
    def test_changed_audio_is_explicitly_blocked(self):
        self.pcm_preview=b"changed PCM"*3000
        r=self.run_fingerprint()
        self.assertFalse(r["decodedAudioExactlyPreserved"])
        self.assertIn("DIRECTOR_RECAST_ORIGINAL_AUDIO_ALTERED",r["blockers"])
        self.assertFalse(r["independentQualityApproved"])
    def test_cross_root_and_changed_file_denied_prior_to_decoder(self):
        with self.assertRaisesRegex(ValueError,"SOURCE_HASH_MISMATCH"):
            self.run_fingerprint(preview_sha256="f"*64)
        self.assertEqual(self.calls,0)
        foreign=self.root.parent/"recast-different-location-test.mp4"
        with self.assertRaisesRegex((ValueError),"AUDIO_PATH_NOT_ADMITTED"):
            self.run_fingerprint(original_video_path=str(foreign))
        self.assertEqual(self.calls,0)
    def test_missing_audio_denied(self):
        def fail(argv,**kwargs):
            return subprocess.CompletedProcess(argv,1,stdout=b"",stderr=b"missing")
        with self.assertRaisesRegex(ValueError,"DECODED_AUDIO_UNAVAILABLE"):
            self.run_fingerprint(runner=fail)

if __name__=="__main__":
    unittest.main()
