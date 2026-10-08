"""Hermetic Basic Pitch adapter tests, no model installation/download or GPU."""
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import performance_transcription as p
from worker import RestorationWorkerConfig

class MidiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source.wav"
        self.source.write_bytes(b"RIFF" + b"x" * 200)
        self.config = RestorationWorkerConfig(output_dir=self.root / "outputs")
        self.args = (self.source, "parent-id", "a" * 64, "job-id",
                     "guitar", p.MODEL_ID, self.config)

    def test_fail_closed_role_model_feature_and_install(self):
        with self.assertRaisesRegex(ValueError, "ISOLATED_INSTRUMENT"):
            p.transcribe_performance_path(*self.args[:4], "vocals", *self.args[5:])
        with self.assertRaisesRegex(ValueError, "MODEL_NOT_ADMITTED"):
            p.transcribe_performance_path(*self.args[:5], "../../custom-model", self.config)
        with self.assertRaisesRegex(RuntimeError, "NOT_ENABLED"):
            p.transcribe_performance_path(*self.args)
        with patch.dict("os.environ", {"MUSIC_RESTORATION_BASIC_PITCH_ENABLED": "YES"}), \
             patch.object(p.util, "find_spec", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "NOT_INSTALLED"):
                p.transcribe_performance_path(*self.args)

    def test_real_write_receipt_bytes_and_no_source_overwrite(self):
        import sys
        class Midi:
            instruments = [SimpleNamespace(notes=[
                SimpleNamespace(pitch=64, velocity=100, start=0.1, end=0.9),
            ])]
            def write(self, path):
                Path(path).write_bytes(b"MThd" + b"x" * 50)
        module = SimpleNamespace(
            ICASSP_2022_MODEL_PATH=self.root / "packaged-model",
        )
        (self.root / "packaged-model").write_bytes(b"mock-model")
        inference = SimpleNamespace(predict=lambda *a, **k: ({}, Midi(), []))
        evidence = {"sampleRate": 48000, "channels": 2, "sampleCount": 48000,
                    "durationSeconds": 1.0}
        with patch.dict("os.environ", {"MUSIC_RESTORATION_BASIC_PITCH_ENABLED": "YES"}), \
             patch.object(p.util, "find_spec", return_value=SimpleNamespace()), \
             patch.object(p, "probe_path", return_value=evidence), \
             patch.object(p.metadata, "version", return_value="0.4.0"), \
             patch.dict(sys.modules, {"basic_pitch": module,
                                     "basic_pitch.inference": inference}):
            receipt = p.transcribe_performance_path(*self.args)
        self.assertEqual(receipt["noteCount"], 1)
        self.assertEqual(receipt["operationClass"], "creative-reconstruction")
        self.assertTrue(receipt["needsHumanReview"])
        self.assertFalse(receipt["restorationCertified"])
        self.assertFalse(receipt["isOriginalPerformanceRecovered"])
        self.assertEqual((self.root / "outputs" /
                          ("transcribe-" + p._safe_token("job-id")) /
                          "transcription.mid").read_bytes(), b"MThd" + b"x" * 50)
        self.assertEqual(self.source.read_bytes(), b"RIFF" + b"x" * 200)
        with self.assertRaisesRegex(ValueError, "ALREADY_EXISTS"):
            with patch.dict("os.environ", {"MUSIC_RESTORATION_BASIC_PITCH_ENABLED": "YES"}), \
                 patch.object(p.util, "find_spec", return_value=SimpleNamespace()), \
                 patch.object(p, "probe_path", return_value=evidence), \
                 patch.dict(sys.modules, {"basic_pitch": module,
                                         "basic_pitch.inference": inference}):
                p.transcribe_performance_path(*self.args)

    def test_excessive_duration_refused_before_inference(self):
        with patch.dict("os.environ", {"MUSIC_RESTORATION_BASIC_PITCH_ENABLED": "YES"}), \
             patch.object(p.util, "find_spec", return_value=SimpleNamespace()), \
             patch.object(p, "probe_path", return_value={
                "sampleRate": 48000, "channels": 2, "sampleCount": 28800000,
                "durationSeconds": 601.0,
             }):
            with self.assertRaisesRegex(ValueError, "LIMIT"):
                p.transcribe_performance_path(*self.args)

if __name__ == "__main__":
    unittest.main()
