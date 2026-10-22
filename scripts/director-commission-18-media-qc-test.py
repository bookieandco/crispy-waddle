#!/usr/bin/env python3
"""Disposable synthetic media tests for Director technical inspector, not real final QC."""
import hashlib
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("director_media_qc", ROOT / "director-commission-18-media-qc.py")
qc = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(qc)


class DirectorMediaQcTest(unittest.TestCase):
    def test_real_decode_and_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            media = Path(tmp) / "synthetic-test-only.mp4"
            subprocess.run([
                "ffmpeg", "-nostdin", "-v", "error", "-y",
                "-f", "lavfi", "-i", "color=c=navy:s=360x640:r=15",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
                "-t", "1.5", "-pix_fmt", "yuv420p",
                "-c:v", "libx264", "-preset", "ultrafast",
                "-c:a", "aac", "-shortest", str(media)
            ], check=True, capture_output=True, timeout=40)
            digest = hashlib.sha256(media.read_bytes()).hexdigest()
            result = qc.validate(media, digest, 1, 3)
            self.assertTrue(result["fullDecodePassed"])
            self.assertFalse(result["canPublish"])
            self.assertFalse(result["independentCreativeQCCertified"])
            self.assertFalse(result["ownerProjectLinked"])
            with self.assertRaisesRegex(ValueError, "SHA256_MISMATCH"):
                qc.validate(media, "0"*64, 1, 3)
            with self.assertRaisesRegex(ValueError, "DURATION_INVALID"):
                qc.validate(media, digest, 10, 30)
            with self.assertRaisesRegex(ValueError, "FILE_INVALID"):
                qc.validate(Path(tmp) / "absent.mp4", digest, 1, 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
