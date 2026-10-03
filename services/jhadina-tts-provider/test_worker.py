import hashlib
import os
import tempfile
import unittest
from unittest.mock import patch

import worker


class FakeEngine:
    provider_id = "qwen3-tts"
    model_id = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
    provider_voice_ref = "jhadina-qwen-v1"
    sample_rate = 24000

    def __init__(self):
        self.loaded = False
        self.synth_calls = []
        self.design_calls = []

    def ensure_loaded(self):
        self.loaded = True

    def synthesize(self, text, language, delivery=None):
        self.synth_calls.append((text, language, delivery))
        return [0.0, 0.1, -0.1], 24000

    def design(self, text, language, instruction, delivery=None, seed=None):
        self.design_calls.append((text, language, instruction, delivery, seed))
        return [0.0, 0.2, -0.2], 24000


class NativeProviderWorkerTest(unittest.TestCase):
    def test_config_defaults_are_provider_specific_and_clone_by_default(self):
        with patch.dict(os.environ, {"JHADINA_TTS_PROVIDER": "qwen3-tts"}, clear=True):
            cfg = worker.ProviderConfig.from_env()
            self.assertEqual(cfg.mode, "clone")
            self.assertEqual(cfg.model_id, worker.DEFAULT_QWEN_CLONE_MODEL)
            self.assertEqual(cfg.provider_voice_ref, "jhadina-qwen-v1")

        with patch.dict(os.environ, {"JHADINA_TTS_PROVIDER": "voxcpm2"}, clear=True):
            cfg = worker.ProviderConfig.from_env()
            self.assertEqual(cfg.model_id, worker.DEFAULT_VOXCPM_MODEL)
            self.assertEqual(cfg.provider_voice_ref, "jhadina-voxcpm2-v1")

    def test_reference_validation_binds_exact_bytes(self):
        with tempfile.NamedTemporaryFile() as reference:
            reference.write(b"canonical-jhadina")
            reference.flush()
            sha = hashlib.sha256(b"canonical-jhadina").hexdigest()
            worker._validate_reference(reference.name, sha)
            with self.assertRaisesRegex(RuntimeError, "REFERENCE_SHA256_MISMATCH"):
                worker._validate_reference(reference.name, "a" * 64)

    def test_qwen_locale_mapping_matches_model_language_contract(self):
        self.assertEqual(worker._qwen_language("en-US"), "English")
        self.assertEqual(worker._qwen_language("es-US"), "Spanish")
        self.assertEqual(worker._qwen_language("Japanese"), "Japanese")
        self.assertEqual(worker._qwen_language(""), "Auto")

    def test_delivery_genome_becomes_bounded_provider_instruction(self):
        instruction = worker._delivery_instruction({
            "style": "playful",
            "rate": 1.08,
            "warmth": 0.8,
            "groundedConfidence": 0.9,
            "conversationality": 0.8,
            "playfulness": 0.9,
            "intimacy": 0.7,
            "energy": 0.8,
        })
        self.assertIn("playful", instruction)
        self.assertIn("quicker", instruction)
        self.assertIn("warm", instruction)
        self.assertLessEqual(len(instruction.split(",")), 6)

    def test_production_response_echoes_exact_canonical_identity_and_never_claims_qc(self):
        fake = FakeEngine()
        with patch("worker._wav_bytes", return_value=b"RIFF-jhadina"):
            result = worker.synthesize_response(
                fake,
                text="Hello.",
                language="en-US",
                voice_profile_id="jhadina:canonical",
                voice_identity_id="voice:jhadina:canonical:v1",
                model_id=fake.model_id,
                provider_voice_ref=fake.provider_voice_ref,
                delivery={"style": "serious"},
            )
        self.assertEqual(result["voiceProfileId"], "jhadina:canonical")
        self.assertEqual(result["voiceIdentityId"], "voice:jhadina:canonical:v1")
        self.assertEqual(result["modelId"], fake.model_id)
        self.assertEqual(result["providerVoiceRef"], fake.provider_voice_ref)
        self.assertFalse(result["qualityClaim"])
        self.assertEqual(fake.synth_calls[0][1], "en-US")

    def test_identity_or_provider_binding_substitution_fails_closed(self):
        fake = FakeEngine()
        with self.assertRaisesRegex(ValueError, "IDENTITY_NOT_ADMITTED"):
            worker.synthesize_response(
                fake,
                text="Hello.",
                language="en-US",
                voice_profile_id="other",
                voice_identity_id="voice:jhadina:canonical:v1",
                model_id=fake.model_id,
                provider_voice_ref=fake.provider_voice_ref,
                delivery=None,
            )
        with self.assertRaisesRegex(ValueError, "MODEL_ID_MISMATCH"):
            worker.synthesize_response(
                fake,
                text="Hello.",
                language="en-US",
                voice_profile_id="jhadina:canonical",
                voice_identity_id="voice:jhadina:canonical:v1",
                model_id="different-model",
                provider_voice_ref=fake.provider_voice_ref,
                delivery=None,
            )

    def test_design_is_explicitly_unapproved(self):
        fake = FakeEngine()
        with patch("worker._wav_bytes", return_value=b"RIFF-candidate"):
            result = worker.design_response(
                fake,
                text="Calibration line.",
                language="en-US",
                voice_profile_id="jhadina:canonical",
                voice_identity_id="voice:jhadina:canonical:v1",
                model_id=fake.model_id,
                provider_voice_ref=fake.provider_voice_ref,
                instruction=worker.ORIGINAL_JHADINA_DESIGN_BRIEF,
                delivery={"style": "thoughtful"},
                seed=7,
            )
        self.assertTrue(result["candidateUnapproved"])
        self.assertEqual(result["approvalState"], "candidate_unapproved")
        self.assertFalse(result["qualityClaim"])
        self.assertEqual(fake.design_calls[0][-1], 7)


if __name__ == "__main__":
    unittest.main()
