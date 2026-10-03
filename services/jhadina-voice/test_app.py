import asyncio
import hashlib
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import app


class FakeSpeakerQc:
    def health(self):
        return {
            "status":"ready",
            "productionReady":True,
            "modelId":"speechbrain/spkrec-ecapa-voxceleb",
            "modelRevision":"ff989f88e92ccc120569763824f8eedd5afc9039",
        }


class VoiceAppContractTest(unittest.TestCase):
    def setUp(self):
        app._router=None

    def test_bearer_boundary_fails_closed(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(HTTPException) as missing:
                app._authorize(None)
            self.assertEqual(missing.exception.status_code,503)

        with patch.dict(os.environ,{"JHADINA_VOICE_TOKEN":"secret"},clear=True):
            with self.assertRaises(HTTPException) as unauthorized:
                app._authorize("Bearer wrong")
            self.assertEqual(unauthorized.exception.status_code,401)
            app._authorize("Bearer secret")

    def test_health_requires_approved_identity_and_qc_for_ready(self):
        provider_env={
            "JHADINA_QWEN3_TTS_URL":"https://qwen.example",
            "JHADINA_QWEN3_TTS_TOKEN":"x",
            "JHADINA_QWEN3_TTS_MODEL_ID":"qwen3-model",
            "JHADINA_QWEN3_TTS_VOICE_REF":"jhadina-qwen-v1",
            "JHADINA_VOXCPM2_TTS_URL":"https://voxcpm.example",
            "JHADINA_VOXCPM2_TTS_TOKEN":"y",
            "JHADINA_VOXCPM2_TTS_MODEL_ID":"voxcpm2-model",
            "JHADINA_VOXCPM2_TTS_VOICE_REF":"jhadina-voxcpm-v1",
        }
        with patch.dict(os.environ,provider_env,clear=True):
            health=app.health()
            self.assertEqual(health["status"],"degraded")
            self.assertEqual(set(health["tts"]),{"qwen3-tts","voxcpm2"})
            self.assertEqual(health["canonicalVoiceIdentityStatus"],"candidate")
            self.assertFalse(health["identityRuntimeReady"])

        reference_bytes=b"canonical-jhadina-reference"
        with tempfile.TemporaryDirectory() as directory:
            reference_path=os.path.join(directory,"reference.wav")
            approval_path=os.path.join(directory,"approval.json")
            with open(reference_path,"wb") as reference:
                reference.write(reference_bytes)
            reference_sha=hashlib.sha256(reference_bytes).hexdigest()
            with open(approval_path,"w",encoding="utf-8") as receipt:
                json.dump({
                    "id":"approval:jhadina:v1",
                    "voiceIdentityId":"voice:jhadina:canonical:v1",
                    "candidateSha256":reference_sha,
                    "speakerFingerprintReceiptId":"fingerprint-receipt:jhadina:v1",
                    "speakerFingerprintRef":"speaker-embedding:ecapa-voxceleb:jhadina-v1",
                    "minimumSpeakerSimilarity":0.80,
                    "authority":"VOICE_EXPLICIT_APPROVAL",
                    "approvedBy":"owner-user-id",
                    "approvedAt":"2026-10-03T20:00:00.000Z",
                },receipt)
            approved_env={
                **provider_env,
                "JHADINA_VOICE_IDENTITY_STATUS":"approved",
                "JHADINA_VOICE_APPROVAL_RECEIPT_ID":"approval:jhadina:v1",
                "JHADINA_VOICE_APPROVAL_RECEIPT_PATH":approval_path,
                "JHADINA_VOICE_REFERENCE_PATH":reference_path,
                "JHADINA_VOICE_REFERENCE_SHA256":reference_sha,
                "JHADINA_SPEAKER_QC_URL":"https://speaker.example",
                "JHADINA_SPEAKER_QC_TOKEN":"qc-secret",
            }
            with patch.dict(os.environ,approved_env,clear=True), patch("app._speaker_qc",return_value=FakeSpeakerQc()):
                health=app.health()
                self.assertEqual(health["status"],"ready")
                self.assertTrue(health["identityRuntimeReady"])
                self.assertTrue(health["speakerQcReady"])
                self.assertEqual(health["canonicalVoiceIdentityStatus"],"approved")
                self.assertEqual(health["streaming"],"progressive-ndjson")

    def test_listen_rejects_unadmitted_mime_before_model_loading(self):
        with patch.dict(os.environ,{"JHADINA_VOICE_TOKEN":"secret"},clear=True):
            body=app.ListenRequest(mimeType="application/octet-stream",audioBase64="eA==")
            with self.assertRaises(HTTPException) as rejected:
                app.listen(body,"Bearer secret")
            self.assertEqual(rejected.exception.status_code,415)


    def test_audition_endpoint_remains_explicitly_unapproved(self):
        class FakeRouter:
            def audition(self,text,language,voice_profile_id,delivery,voice_identity_id):
                return {
                    "provider":"qwen3-tts",
                    "mimeType":"audio/wav",
                    "audioBase64":"UklGRg==",
                    "audioSha256":"a"*64,
                    "providerTaskId":"provider-task-1",
                    "voiceProfileId":voice_profile_id,
                    "voiceIdentityId":voice_identity_id,
                    "approvalState":"candidate_unapproved",
                    "candidateUnapproved":True,
                    "qualityClaim":False,
                }

        body=app.SpeakRequest(
            text="Calibration audition.",
            language="en-US",
            voiceProfileId="jhadina:canonical",
            voiceIdentityId="voice:jhadina:canonical:v1",
        )
        with patch.dict(os.environ,{"JHADINA_VOICE_TOKEN":"secret"},clear=True), patch("app.router",return_value=FakeRouter()):
            result=app.audition(body,"Bearer secret")
        self.assertTrue(result["candidateUnapproved"])
        self.assertEqual(result["approvalState"],"candidate_unapproved")
        self.assertFalse(result["qualityClaim"])
        self.assertEqual(result["providerTaskId"],"provider-task-1")

    def test_stream_endpoint_preserves_canonical_identity_and_ndjson_contract(self):
        class FakeRouter:
            def speak_stream(self,text,language,voice_profile_id,delivery,voice_identity_id,max_chars):
                self.args=(text,language,voice_profile_id,delivery,voice_identity_id,max_chars)
                yield {
                    "type":"audio",
                    "index":0,
                    "count":1,
                    "mimeType":"audio/wav",
                    "audioBase64":"UklGRg==",
                    "provider":"voxcpm2",
                    "voiceProfileId":"jhadina:canonical",
                    "voiceIdentityId":"voice:jhadina:canonical:v1",
                    "text":text,
                }
                yield {"type":"done","count":1,"voiceProfileId":"jhadina:canonical","voiceIdentityId":"voice:jhadina:canonical:v1"}

        fake=FakeRouter()
        body=app.SpeakRequest(
            text="Hello there.",
            language="en-US",
            voiceProfileId="jhadina:canonical",
            maxChars=120,
            delivery={
                "style":"playful",
                "rate":1.08,
                "microPauseDensity":0.4,
                "thoughtPauseDurationMs":360,
                "pitchContour":"dynamic",
                "warmth":0.8,
                "playfulness":0.9,
                "operationalSass":0.5,
            },
        )
        with patch.dict(os.environ,{"JHADINA_VOICE_TOKEN":"secret"},clear=True), patch("app.router",return_value=fake):
            response=app.speak_stream(body,"Bearer secret")
            async def collect():
                return [line async for line in response.body_iterator]
            lines=asyncio.run(collect())
        decoded=[json.loads(line.decode() if isinstance(line,bytes) else line) for line in lines]
        self.assertEqual(decoded[0]["type"],"audio")
        self.assertEqual(decoded[-1]["type"],"done")
        self.assertEqual(fake.args[2],"jhadina:canonical")
        self.assertEqual(fake.args[3]["style"],"playful")
        self.assertEqual(fake.args[3]["pitchContour"],"dynamic")
        self.assertEqual(fake.args[3]["playfulness"],0.9)
        self.assertEqual(fake.args[3]["thoughtPauseDurationMs"],360)
        self.assertEqual(fake.args[4],"voice:jhadina:canonical:v1")
        self.assertEqual(fake.args[5],120)


if __name__=="__main__":
    unittest.main()
