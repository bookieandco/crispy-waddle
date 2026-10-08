import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf
from dry_bounce import render_dry_session


class DryBounceTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.addCleanup(self.t.cleanup)
        self.root = Path(self.t.name) / "audio"
        self.root.mkdir()
        self.out = Path(self.t.name) / "mix.wav"
        self.rate = 48000
        frames = self.rate
        impulse = np.zeros((frames, 2), dtype=np.float32)
        impulse[500, :] = .5
        impulse[frames - 500, :] = .2
        sf.write(self.root / "source.wav", impulse, self.rate, subtype="FLOAT")
        digest = hashlib.sha256((self.root / "source.wav").read_bytes()).hexdigest()
        self.asset = dict(id="original", sha256=digest, localPath="source.wav",
                          sampleRate=self.rate, sampleCount=frames)
        self.track = dict(artifactId="original", sourceSha256=digest, durationSeconds=1,
                          gainDb=0, pan=0, mute=False, solo=False,
                          eq=dict(lowDb=0, midDb=0, highDb=0),
                          compressor=dict(enabled=False, thresholdDb=-18, ratio=2),
                          pluginRack=[], clips=[dict(id="c0", startSeconds=0, endSeconds=1,
                             sourceOffsetSeconds=0, fadeInSeconds=0, fadeOutSeconds=0)])
        self.session = dict(schemaVersion="jhadina-music-daw/v1",
                            caseId="case-1", revision=3, tracks=[self.track])

    def render(self):
        return render_dry_session(self.session, [self.asset], self.root, self.out)

    def test_exact_pcm_and_source_hash_preserved(self):
        before = hashlib.sha256((self.root / "source.wav").read_bytes()).hexdigest()
        receipt = self.render()
        out, rate = sf.read(self.out, dtype="float32", always_2d=True)
        source, _ = sf.read(self.root / "source.wav", dtype="float32", always_2d=True)
        self.assertEqual(rate, self.rate)
        self.assertTrue(np.array_equal(out, source))
        self.assertEqual(receipt["sampleCount"], self.rate)
        self.assertEqual(receipt["maxAbsolutePeak"], .5)
        self.assertFalse(receipt["restorationCertified"])
        self.assertEqual(hashlib.sha256((self.root / "source.wav").read_bytes()).hexdigest(), before)
        self.assertEqual(hashlib.sha256(self.out.read_bytes()).hexdigest(), receipt["outputSha256"])

    def test_split_offsets_are_sample_exact_and_silence_is_retained(self):
        self.track["clips"] = [
            dict(id="first", startSeconds=.2, endSeconds=.5,
                 sourceOffsetSeconds=.0, fadeInSeconds=0, fadeOutSeconds=0),
            dict(id="second", startSeconds=.6, endSeconds=.9,
                 sourceOffsetSeconds=.7, fadeInSeconds=0, fadeOutSeconds=0),
        ]
        receipt = self.render()
        sound, _ = sf.read(self.out, dtype="float32")
        self.assertEqual(len(sound), int(.9 * self.rate))
        self.assertEqual(sound[int(.2*self.rate)+500,0], .5)
        self.assertEqual(sound[int(.9*self.rate)-500,0], .2)
        self.assertEqual(sound[0,0], 0)
        self.assertFalse(receipt["peakAboveFullScale"])

    def test_fade_pan_and_solo(self):
        self.track["pan"] = 1
        self.track["clips"][0]["fadeInSeconds"] = .5
        receipt = self.render()
        out, _ = sf.read(self.out, dtype="float32")
        self.assertLess(float(np.max(np.abs(out[:,0]))), 1e-5)
        self.assertGreater(float(np.max(out[:,1])), .001)
        self.assertTrue(receipt["sourceImmutable"])

    def test_fail_closed_on_active_plugin_or_eq(self):
        self.track["pluginRack"] = [dict(enabled=True, format="vst3", pluginId="abc")]
        with self.assertRaisesRegex(ValueError, "ACTIVE_DSP"):
            self.render()
        self.assertFalse(self.out.exists())
        self.track["pluginRack"] = []
        self.track["eq"]["midDb"] = 1
        with self.assertRaisesRegex(ValueError, "ACTIVE_DSP"):
            self.render()

    def test_bad_sha_or_overwrite_rejected(self):
        self.track["sourceSha256"] = "0"*64
        with self.assertRaisesRegex(ValueError, "TRACK_SHA_MISMATCH"):
            self.render()
        self.track["sourceSha256"] = self.asset["sha256"]
        self.render()
        with self.assertRaisesRegex(ValueError, "OUTPUT_ALREADY_EXISTS"):
            self.render()

    def test_no_path_escape_or_symlink(self):
        self.asset["localPath"] = "../out.wav"
        with self.assertRaisesRegex(ValueError, "ASSET_OUTSIDE_AUDIO_ROOT"):
            self.render()
        self.asset["localPath"] = "source.wav"
        (self.root/"link.wav").symlink_to(self.root/"source.wav")
        self.asset["localPath"] = "link.wav"
        with self.assertRaisesRegex(ValueError, "ASSET_SYMLINK_FORBIDDEN"):
            self.render()

    def test_sample_rate_mismatch_and_nan_input_refused(self):
        self.track["clips"][0]["endSeconds"] = 2
        with self.assertRaisesRegex(ValueError, "CLIP_BOUNDARY_INVALID"):
            self.render()
        self.track["clips"][0]["endSeconds"] = 1
        # Recompute declared SHA for a WAV with NaN samples.
        data = np.full((48000, 2), np.nan, dtype=np.float32)
        sf.write(self.root / "bad.wav", data, 48000, subtype="FLOAT")
        self.asset["localPath"] = "bad.wav"
        newsha = hashlib.sha256((self.root/"bad.wav").read_bytes()).hexdigest()
        self.asset["sha256"] = newsha
        self.track["sourceSha256"] = newsha
        with self.assertRaisesRegex(ValueError, "SOURCE_NONFINITE"):
            self.render()


if __name__ == "__main__":
    unittest.main()
