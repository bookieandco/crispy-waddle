"""Measured float residual + readback conservation, no model or GPU needed."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from deep_stems import _computed_residual

class DrumConservationTests(unittest.TestCase):
    def test_sum_to_parent_with_overlapping_children_and_float_residual(self):
        import numpy as np
        import soundfile as sf
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            sr = 48000
            time = np.arange(sr // 2, dtype=np.float64) / sr
            left = .5 * np.sin(time * 2 * np.pi * 84)
            right = .4 * np.sin(time * 2 * np.pi * 176)
            original = np.stack((left, right), axis=1)
            parent = root / "drums.wav"
            sf.write(parent, original, sr, subtype="PCM_24")
            children = []
            # Deliberately over-attribute low content to demonstrate why a
            # float residual (which may exceed 0 dBFS) must not be clipped.
            for idx, amount in enumerate((1.0, .8, .7, .5, .2)):
                target = root / f"sub{idx}.wav"
                sf.write(target, original * amount, sr, subtype="FLOAT")
                children.append(target)
            residual = root / "residual.wav"
            qc = _computed_residual(parent, children, residual)
            self.assertTrue(qc["recombinedRenderMeasured"])
            self.assertFalse(qc["isolationCertified"])
            self.assertLess(qc["recombinationErrorRatio"], 2e-6)
            self.assertLess(qc["maxAbsoluteRecombinationError"], 5e-5)
            self.assertGreater(qc["residualEnergyRatio"], 1.0)
            with sf.SoundFile(residual) as audio:
                self.assertEqual(audio.subtype, "FLOAT")
                self.assertEqual(audio.samplerate, sr)
                self.assertEqual(len(audio), len(original))

    def test_mismatched_frame_count_does_not_issue_receipt(self):
        import numpy as np
        import soundfile as sf
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent, child = root / "parent.wav", root / "child.wav"
            sf.write(parent, np.ones((1024, 2)) * .1, 48000)
            sf.write(child, np.ones((1023, 2)) * .1, 48000)
            with self.assertRaisesRegex(ValueError, "ALIGNMENT_INVALID"):
                _computed_residual(parent, [child], root / "residual.wav")

    def test_silent_parent_does_not_pass_qc(self):
        import numpy as np
        import soundfile as sf
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            parent, child = root / "parent.wav", root / "child.wav"
            sf.write(parent, np.zeros((1024, 1)), 48000)
            sf.write(child, np.zeros((1024, 1)), 48000)
            with self.assertRaisesRegex(ValueError, "SILENT_PARENT"):
                _computed_residual(parent, [child], root / "residual.wav")

if __name__ == "__main__":
    unittest.main()
