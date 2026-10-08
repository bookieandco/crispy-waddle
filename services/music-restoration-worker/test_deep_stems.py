"""MUSIC-DEEPSTEMS CPU-only policy tests; no third-party model downloads."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parent))
import deep_stems as ds
import worker


class DeepDrumsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "input.wav"
        self.source.write_bytes(b"test-source")
        self.config = worker.RestorationWorkerConfig(output_dir=self.root / "out")

    def call(self, role="drums", model=ds.DRUM_MODEL):
        return ds.separate_drums_path(self.source, "parent-drums", "a" * 64,
                                      "job-1", role, model, self.config)

    def test_unknown_parent_and_model_rejected_before_loading(self):
        with self.assertRaisesRegex(ValueError, "PARENT_ROLE"):
            self.call(role="vocals")
        with self.assertRaisesRegex(ValueError, "MODEL_NOT_ADMITTED"):
            self.call(model="../../arbitrary-model")

    def test_model_absence_is_explicit_abstention(self):
        with patch.object(ds.shutil, "which", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "NOT_INSTALLED"):
                self.call()

    def test_real_command_shape_and_hash_bound_substem_receipts(self):
        def fake_probe(path, identity, digest):
            return {"sampleRate": 48000, "channels": 2, "sampleCount": 48000,
                    "durationSeconds": 1.0}
        def fake_normalize(src, dst, rate, channels):
            dst.write_bytes(b"normalized-stem" + src.read_bytes())
        def fake_run(command, **_kwargs):
            self.assertEqual(command[:2], ["drumsep", str(self.config.output_dir /
                                                         ("deep-drums-" + worker._safe_token("job-1")) /
                                                         "parent.wav")])
            out = Path(command[-1])
            for role in ds.DRUM_ROLES:
                (out / (role + ".wav")).write_bytes(b"RIFF" + bytes(role, "ascii") + b"x" * 80)
            return Mock(returncode=0, stdout=b"")
        with patch.object(ds.shutil, "which", return_value="/usr/bin/drumsep"), \
             patch.object(ds, "probe_path", side_effect=fake_probe), \
             patch.object(ds, "normalize_to_wav", side_effect=fake_normalize), \
             patch.object(ds.subprocess, "run", side_effect=fake_run), \
             patch.object(ds, "_computed_residual", side_effect=lambda a, b, c:
                          (c.write_bytes(b"residual"), {"residualRmsRatio": 0.2,
                                                        "residualEnergyRatio": 0.04})[1]), \
             patch.object(ds, "package_version", return_value="1.0.0"):
            receipt = self.call()
        self.assertEqual([s["role"] for s in receipt["stems"]], [*ds.DRUM_ROLES, "residual"])
        self.assertEqual(len(set(s["sha256"] for s in receipt["stems"])), len(receipt["stems"]))
        self.assertTrue(all(s["parentArtifactId"] == "parent-drums" for s in receipt["stems"]))
        self.assertTrue(all(s["confidenceStatus"] == "unmeasured" for s in receipt["stems"]))
        self.assertFalse(receipt["restorationCertified"])
        self.assertTrue(receipt["needsListeningReview"])

    def test_repeated_job_fails_closed_without_clobber(self):
        with patch.object(ds.shutil, "which", return_value="/usr/bin/drumsep"), \
             patch.object(ds, "probe_path", return_value={
                 "sampleRate": 48000, "channels": 2,
                 "sampleCount": 48000, "durationSeconds": 1.0,
             }):
            root = self.config.output_dir / ("deep-drums-" + worker._safe_token("job-1"))
            root.mkdir(parents=True)
            (root / "keep.txt").write_text("unchanged")
            with self.assertRaisesRegex(ValueError, "ALREADY_EXISTS"):
                self.call()
            self.assertEqual((root / "keep.txt").read_text(), "unchanged")


if __name__ == "__main__":
    unittest.main()
