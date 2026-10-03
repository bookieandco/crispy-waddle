import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import app


class FakeEngine:
    provider_id = "qwen3-tts"
    model_id = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
    provider_voice_ref = "jhadina-qwen-v1"
    sample_rate = 24000

    def __init__(self):
        self.loaded = False

    def ensure_loaded(self):
        self.loaded = True

    def synthesize(self, *_args, **_kwargs):
        return [0.0], 24000

    def design(self, *_args, **_kwargs):
        return [0.0], 24000


class NativeProviderAppTest(unittest.TestCase):
    def setUp(self):
        app._engine = None

    def test_bearer_auth_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as missing:
                app._authorize(None)
            self.assertEqual(missing.exception.status_code, 503)
        with patch.dict(os.environ, {"JHADINA_TTS_TOKEN": "secret"}, clear=True):
            with self.assertRaises(HTTPException) as wrong:
                app._authorize("Bearer nope")
            self.assertEqual(wrong.exception.status_code, 401)
            app._authorize("Bearer secret")

    def test_clone_health_is_production_ready_only_after_model_load(self):
        fake = FakeEngine()
        env = {
            "JHADINA_TTS_PROVIDER": "qwen3-tts",
            "JHADINA_TTS_MODE": "clone",
            "JHADINA_TTS_MODEL_ID": fake.model_id,
            "JHADINA_TTS_VOICE_REF": fake.provider_voice_ref,
        }
        with patch.dict(os.environ, env, clear=True), patch("app.engine", return_value=fake):
            health = app.health()
        self.assertEqual(health["status"], "ready")
        self.assertTrue(health["productionReady"])
        self.assertFalse(health["auditionReady"])
        self.assertTrue(fake.loaded)
        self.assertEqual(health["voiceIdentityId"], "voice:jhadina:canonical:v1")

    def test_design_health_never_claims_production_readiness(self):
        fake = FakeEngine()
        env = {
            "JHADINA_TTS_PROVIDER": "qwen3-tts",
            "JHADINA_TTS_MODE": "design",
            "JHADINA_TTS_MODEL_ID": fake.model_id,
            "JHADINA_TTS_VOICE_REF": fake.provider_voice_ref,
        }
        with patch.dict(os.environ, env, clear=True), patch("app.engine", return_value=fake):
            health = app.health()
        self.assertTrue(health["auditionReady"])
        self.assertFalse(health["productionReady"])

    def test_speak_proxies_only_canonical_binding(self):
        fake = FakeEngine()
        body = app.SpeakRequest(
            text="Hello there.",
            language="en-US",
            voiceProfileId="jhadina:canonical",
            voiceIdentityId="voice:jhadina:canonical:v1",
            modelId=fake.model_id,
            providerVoiceRef=fake.provider_voice_ref,
        )
        with patch.dict(os.environ, {"JHADINA_TTS_TOKEN": "secret"}, clear=True), \
             patch("app.engine", return_value=fake), \
             patch("app.synthesize_response", return_value={"ok": True}) as synth:
            result = app.speak(body, "Bearer secret")
        self.assertEqual(result, {"ok": True})
        self.assertEqual(synth.call_args.kwargs["voice_identity_id"], "voice:jhadina:canonical:v1")

    def test_design_route_remains_candidate_authority_only(self):
        fake = FakeEngine()
        body = app.DesignRequest(
            text="Calibration line.",
            language="en-US",
            voiceProfileId="jhadina:canonical",
            voiceIdentityId="voice:jhadina:canonical:v1",
            modelId=fake.model_id,
            providerVoiceRef=fake.provider_voice_ref,
            instruction="Original warm grounded voice.",
            seed=1,
        )
        response = {
            "candidateUnapproved": True,
            "approvalState": "candidate_unapproved",
            "qualityClaim": False,
        }
        with patch.dict(os.environ, {"JHADINA_TTS_TOKEN": "secret"}, clear=True), \
             patch("app.engine", return_value=fake), \
             patch("app.design_response", return_value=response):
            result = app.design(body, "Bearer secret")
        self.assertTrue(result["candidateUnapproved"])
        self.assertFalse(result["qualityClaim"])


if __name__ == "__main__":
    unittest.main()
