"""Offline Recast review-package tests with synthetic media-decoder outputs."""
from __future__ import annotations
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("recast_local_review_package",HERE/"recast_local_review_package.py")
assert spec is not None and spec.loader is not None
recast=importlib.util.module_from_spec(spec)
spec.loader.exec_module(recast)

class LocalReviewPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.src=self.root/"source.mp4"
        self.out=self.root/"preview.mp4"
        self.src.write_bytes(b"source fixture")
        self.out.write_bytes(b"preview fixture")
        self.changed_audio=False
        self.bad_duration=False
        self.commands=[]
    def runner(self,argv,**kwargs):
        self.commands.append(argv)
        is_preview=str(self.out)==argv[-1] if argv[0]=="ffprobe" else str(self.out)==argv[argv.index("-i")+1]
        if argv[0]=="ffprobe":
            payload={"format":{"duration":"6.5" if (is_preview and self.bad_duration) else "6"},
                "streams":[{"codec_type":"video","width":640,"height":480},{"codec_type":"audio"}]}
            return subprocess.CompletedProcess(argv,0,stdout=json.dumps(payload),stderr="")
        sound=b"pcm_source"*300
        if self.changed_audio and is_preview:sound=b"pcm_altered"*300
        return subprocess.CompletedProcess(argv,0,stdout=sound,stderr=b"")
    def run_pkg(self,**kw):
        kwargs=dict(
            admitted_media_root=str(self.root),source_path=str(self.src),preview_path=str(self.out),
            source_sha256=hashlib.sha256(self.src.read_bytes()).hexdigest(),
            preview_sha256=hashlib.sha256(self.out.read_bytes()).hexdigest(),
            project_id="project:1",source_asset_id="source:1",preview_asset_id="preview:1",
            runner=self.runner,
        )
        kwargs.update(kw)
        return recast.build_recast_local_review_package(**kwargs)
    def test_good_local_preview_is_only_ready_for_manual_review(self):
        result=self.run_pkg()
        self.assertTrue(result["readyForManualReview"])
        self.assertEqual(len(result["manifestSha256"]),64)
        for field in ("identityReviewed","lipSyncVerified","likenessAndRightsConfirmed",
                      "independentQCApproved","ownerApproved","runAuthorized","renderWorkerInvoked"):
            self.assertIs(result[field],False)
        self.assertEqual(result["publicationAuthority"],"NONE")
        self.assertEqual(len(self.commands),4)
    def test_changed_audio_or_durations_block_manual_review(self):
        self.changed_audio=True
        self.assertIn("DIRECTOR_RECAST_ORIGINAL_AUDIO_ALTERED",self.run_pkg()["blockers"])
        self.changed_audio=False
        self.bad_duration=True
        self.assertIn("DIRECTOR_RECAST_LOCAL_CLIP_DURATION_MISMATCH",self.run_pkg()["blockers"])
    def test_forged_media_hash_never_reaches_decoder(self):
        with self.assertRaisesRegex(ValueError,"SOURCE_HASH_MISMATCH"):
            self.run_pkg(source_sha256="f"*64)
        self.assertEqual(self.commands,[])

if __name__=="__main__":
    unittest.main()
