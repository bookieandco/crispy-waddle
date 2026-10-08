"""Actual stereo audio owner-annotated masking and readback conservation."""
import sys
import tempfile
import shutil
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
import soundfile as sf
sys.path.insert(0, str(Path(__file__).parent))
import reviewed_vocal_regions as v
from worker import RestorationWorkerConfig

class VocalReviewRenderTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        rate = 16000
        t = np.arange(rate * 2, dtype=float) / rate
        sound = np.stack((.25*np.sin(2*np.pi*440*t), .15*np.sin(2*np.pi*330*t)), axis=1)
        self.source = self.root / "source.wav"
        sf.write(self.source, sound, rate, subtype="FLOAT")
        self.config = RestorationWorkerConfig(output_dir=self.root / "output")
        probe = patch.object(v, "probe_path", return_value={
            "durationSeconds": 2.0, "sampleRate": rate,
            "channels": 2, "sampleCount": rate * 2,
        })
        normalize = patch.object(v, "normalize_to_wav",
                                 side_effect=lambda source, dest, _sr, _ch: shutil.copyfile(source, dest))
        probe.start()
        normalize.start()
        self.addCleanup(probe.stop)
        self.addCleanup(normalize.stop)
        self.regions = [
            {"role":"lead","startMs":100,"endMs":750,"ownerReviewed":True,"reviewEvidenceId":"review-1"},
            {"role":"ad-lib","startMs":1000,"endMs":1550,"ownerReviewed":True,"reviewEvidenceId":"review-2"},
        ]
    def run_it(self, regions=None):
        from hashlib import sha256
        sha = sha256(self.source.read_bytes()).hexdigest()
        return v.render_reviewed_vocal_regions(self.source, "parent", sha,
                                                 "job", "vocals",
                                                 regions if regions is not None else self.regions,self.config)
    def test_actual_audio_is_time_aligned_and_residual_conserved(self):
        x=self.run_it()
        self.assertFalse(x["automatedSpeakerSeparationPerformed"])
        self.assertFalse(x["qc"]["isolationCertified"])
        self.assertTrue(x["qc"]["recombinedRenderMeasured"])
        self.assertLess(x["qc"]["recombinationErrorRatio"],2e-6)
        self.assertEqual({s["role"] for s in x["stems"]},{"lead","ad-lib","residual"})
        with sf.SoundFile(self.source) as p:
            parent = p.read(always_2d=True)
        with sf.SoundFile(self.config.output_dir/("vocal-regions-"+v._safe_token("job"))/"ad-lib.wav") as a:
            child = a.read(always_2d=True)
        self.assertEqual(child.shape,parent.shape)
        self.assertTrue(np.allclose(child[:1200],0))
        self.assertGreater(np.max(np.abs(child[18000:20000])),.05)
        self.assertEqual(self.source.stat().st_size, 256088)
    def test_ambiguous_overlap_refused_even_if_roles_differ(self):
        bad = self.regions + [{"role":"harmony","startMs":700,"endMs":1500,
           "ownerReviewed":True,"reviewEvidenceId":"review-3"}]
        with self.assertRaisesRegex(ValueError,"OVERLAP_AMBIGUOUS"):
            self.run_it(bad)
    def test_owner_evidence_is_mandatory(self):
        invalid = [dict(self.regions[0],ownerReviewed=False)]
        with self.assertRaisesRegex(ValueError,"OWNER_REVIEW_REQUIRED"):
            self.run_it(invalid)
    def test_reject_unreviewed_vocal_identity_and_invalid_parent_role(self):
        with self.assertRaisesRegex(ValueError,"SEPARATED_VOCALS"):
            from hashlib import sha256
            v.render_reviewed_vocal_regions(self.source,"parent",
              sha256(self.source.read_bytes()).hexdigest(),"job","vocals-other",self.regions,self.config)
if __name__ == "__main__": unittest.main()
