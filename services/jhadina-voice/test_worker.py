import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from worker import (
    AuthenticatedHttpTtsEngine,
    VoiceIdentityRuntimePolicy,
    VoiceRouter,
    DEFAULT_SPEAKER_QC_MODEL_ID,
    DEFAULT_SPEAKER_QC_MODEL_REVISION,
    split_speech_chunks,
)


class FakeTts:
    def __init__(self, engine_id, succeeds, audio=b"RIFF-jhadina"):
        self.id=engine_id
        self.succeeds=succeeds
        self.audio=audio
        self.calls=[]
        self.model_id=engine_id+"-model"
        self.provider_voice_ref=engine_id+"-jhadina-v1"
    def supports(self, _language):
        return True
    def synthesize(self, text, _language, _profile, delivery=None, voice_identity_id="voice:jhadina:canonical:v1"):
        self.calls.append((text,delivery,voice_identity_id))
        if not self.succeeds:
            raise RuntimeError("provider offline")
        return self.audio


class FakeSpeakerQc:
    def __init__(self, similarities):
        self.similarities=list(similarities)
        self.calls=[]

    def health(self):
        return {
            "status":"ready",
            "productionReady":True,
            "modelId":DEFAULT_SPEAKER_QC_MODEL_ID,
            "modelRevision":DEFAULT_SPEAKER_QC_MODEL_REVISION,
        }

    def verify(self, reference_audio, reference_mime_type, candidate_audio, candidate_mime_type):
        self.calls.append((reference_audio,reference_mime_type,candidate_audio,candidate_mime_type))
        similarity=self.similarities.pop(0)
        return {
            "similarity":similarity,
            "modelId":DEFAULT_SPEAKER_QC_MODEL_ID,
            "modelRevision":DEFAULT_SPEAKER_QC_MODEL_REVISION,
            "referenceSha256":hashlib.sha256(reference_audio).hexdigest(),
            "candidateSha256":hashlib.sha256(candidate_audio).hexdigest(),
            "referenceDurationSeconds":8.0,
            "candidateDurationSeconds":7.0,
            "qualityClaim":False,
        }


class FakeResponse:
    def __init__(self,payload):
        self.payload=payload
    def read(self):
        return json.dumps(self.payload).encode()
    def __enter__(self):
        return self
    def __exit__(self,*_args):
        return False


class VoiceWorkerTest(unittest.TestCase):
    def test_native_tts_fails_over_without_changing_identity(self):
        router=VoiceRouter([],[
            FakeTts("qwen3-tts",False),
            FakeTts("voxcpm2",True),
        ])
        result=router.speak("hello","en-US","jhadina:canonical",{"rate":0.9})
        self.assertEqual(result["provider"],"voxcpm2")
        self.assertEqual(result["voiceProfileId"],"jhadina:canonical")
        self.assertEqual(result["voiceIdentityId"],"voice:jhadina:canonical:v1")
        self.assertEqual(base64.b64decode(result["audioBase64"]),b"RIFF-jhadina")

    def test_noncanonical_voice_identity_is_rejected(self):
        router=VoiceRouter([],[FakeTts("qwen3-tts",True)])
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            router.speak("hello","en-US","someone-else")

    def test_progressive_stream_yields_audio_chunks_then_done(self):
        engine=FakeTts("voxcpm2",True)
        router=VoiceRouter([],[engine])
        events=list(router.speak_stream(
            "First sentence establishes the point clearly. "
            "Second sentence adds enough detail that progressive synthesis should emit another bounded chunk. "
            "Third sentence closes the response without changing the canonical voice identity.",
            "en-US",
            "jhadina:canonical",
            {"style":"playful"},
            max_chars=80,
        ))
        self.assertGreaterEqual(len(events),3)
        self.assertTrue(all(event["type"]=="audio" for event in events[:-1]))
        self.assertEqual(events[-1]["type"],"done")
        self.assertEqual(events[-1]["count"],len(events)-1)
        self.assertTrue(all(call[1]=={"style":"playful"} for call in engine.calls))
        self.assertTrue(all(call[2]=="voice:jhadina:canonical:v1" for call in engine.calls))

    def test_chunker_is_bounded_and_nonempty(self):
        chunks=split_speech_chunks(
            "First sentence. Second sentence is much longer, because it should be split before progressive playback stalls.",
            80,
        )
        self.assertTrue(chunks)
        self.assertTrue(all(chunk and len(chunk)<=80 for chunk in chunks))

    def test_http_provider_requires_canonical_profile_and_wav_and_forwards_delivery(self):
        engine=AuthenticatedHttpTtsEngine(
            "qwen3-tts","https://tts.example/speak","secret",["en-US"],
            "qwen3-tts-model","jhadina-v1",
        )
        payload={
            "voiceProfileId":"jhadina:canonical",
            "voiceIdentityId":"voice:jhadina:canonical:v1",
            "modelId":"qwen3-tts-model",
            "providerVoiceRef":"jhadina-v1",
            "mimeType":"audio/wav",
            "audioBase64":base64.b64encode(b"RIFF").decode(),
        }
        captured={}

        def fake_urlopen(request,timeout=0):
            captured["body"]=json.loads(request.data.decode())
            captured["timeout"]=timeout
            return FakeResponse(payload)

        with patch("worker.urllib.request.urlopen",side_effect=fake_urlopen):
            self.assertEqual(
                engine.synthesize(
                    "hello",
                    "en-US",
                    "jhadina:canonical",
                    {"rate":0.9,"pauseScale":1.2,"style":"threshold"},
                    "voice:jhadina:canonical:v1",
                ),
                b"RIFF",
            )
        self.assertEqual(captured["body"]["delivery"]["style"],"threshold")
        self.assertEqual(captured["body"]["voiceIdentityId"],"voice:jhadina:canonical:v1")
        self.assertEqual(captured["body"]["modelId"],"qwen3-tts-model")
        self.assertEqual(captured["body"]["providerVoiceRef"],"jhadina-v1")
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            engine.synthesize("hello","en-US","other")
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            engine.synthesize("hello","en-US","jhadina:canonical",None,"voice:bonez:canonical:v1")


    def test_candidate_identity_can_audition_but_cannot_production_speak(self):
        with tempfile.NamedTemporaryFile() as reference:
            reference.write(b"reference-audio")
            reference.flush()
            policy=VoiceIdentityRuntimePolicy(
                status="candidate",
                reference_audio_path=reference.name,
                reference_sha256=hashlib.sha256(b"reference-audio").hexdigest(),
            )
            router=VoiceRouter([],[FakeTts("qwen3-tts",True)],identity_policy=policy)
            audition=router.audition("hello","en-US")
            self.assertTrue(audition["candidateUnapproved"])
            self.assertEqual(audition["approvalState"],"candidate_unapproved")
            self.assertFalse(audition["qualityClaim"])
            with self.assertRaisesRegex(RuntimeError,"JHADINA_VOICE_IDENTITY_RUNTIME_BLOCKED"):
                router.speak("hello","en-US")

    def test_low_similarity_provider_fails_over_to_identity_preserving_provider(self):
        reference_bytes=b"canonical-jhadina-reference"
        with tempfile.NamedTemporaryFile() as reference:
            reference.write(reference_bytes)
            reference.flush()
            policy=VoiceIdentityRuntimePolicy(
                status="approved",
                approval_receipt_id="approval:jhadina:v1",
                reference_audio_path=reference.name,
                reference_mime_type="audio/wav",
                reference_sha256=hashlib.sha256(reference_bytes).hexdigest(),
                minimum_speaker_similarity=0.80,
            )
            qc=FakeSpeakerQc([0.71,0.91])
            router=VoiceRouter(
                [],
                [
                    FakeTts("qwen3-tts",True,b"provider-one-audio"),
                    FakeTts("voxcpm2",True,b"provider-two-audio"),
                ],
                identity_policy=policy,
                speaker_qc=qc,
            )
            result=router.speak("hello","en-US")
            self.assertEqual(result["provider"],"voxcpm2")
            self.assertEqual(result["voiceIdentityId"],"voice:jhadina:canonical:v1")
            self.assertAlmostEqual(result["identityVerification"]["similarity"],0.91)
            self.assertEqual(result["identityVerification"]["approvalReceiptId"],"approval:jhadina:v1")
            self.assertEqual(len(qc.calls),2)

    def test_approved_identity_fails_closed_without_speaker_qc(self):
        reference_bytes=b"canonical-jhadina-reference"
        with tempfile.NamedTemporaryFile() as reference:
            reference.write(reference_bytes)
            reference.flush()
            policy=VoiceIdentityRuntimePolicy(
                status="approved",
                approval_receipt_id="approval:jhadina:v1",
                reference_audio_path=reference.name,
                reference_sha256=hashlib.sha256(reference_bytes).hexdigest(),
                minimum_speaker_similarity=0.80,
            )
            router=VoiceRouter(
                [],
                [FakeTts("qwen3-tts",True)],
                identity_policy=policy,
                speaker_qc=None,
            )
            with self.assertRaisesRegex(RuntimeError,"VOICE_TTS_FAILED"):
                router.speak("hello","en-US")


if __name__=="__main__":
    unittest.main()
