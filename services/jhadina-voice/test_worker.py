import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from worker import (
    AuthenticatedHttpSpeakerQcVerifier,
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
        self.provider_task_id=engine_id+"-task-1"
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


def write_approval_receipt(directory, reference_sha256, receipt_id="approval:jhadina:v1"):
    path=Path(directory)/"approval.json"
    path.write_text(json.dumps({
        "id":receipt_id,
        "voiceIdentityId":"voice:jhadina:canonical:v1",
        "candidateSha256":reference_sha256,
        "speakerFingerprintReceiptId":"fingerprint-receipt:jhadina:v1",
        "speakerFingerprintRef":"speaker-embedding:ecapa-voxceleb:jhadina-v1",
        "minimumSpeakerSimilarity":0.80,
        "authority":"VOICE_EXPLICIT_APPROVAL",
        "approvedBy":"owner-user-id",
        "approvedAt":"2026-10-03T20:00:00.000Z",
    }),encoding="utf-8")
    return str(path)


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
            "providerTaskId":"provider-task-1",
            "mimeType":"audio/wav",
            "audioBase64":base64.b64encode(b"RIFF").decode(),
        }
        captured={}

        def fake_urlopen(request,timeout=0):
            captured["body"]=json.loads(request.data.decode())
            captured["timeout"]=timeout
            return FakeResponse(payload)

        with patch("worker.urllib.request.urlopen",side_effect=fake_urlopen):
            artifact=engine.synthesize(
                "hello",
                "en-US",
                "jhadina:canonical",
                {"rate":0.9,"pauseScale":1.2,"style":"threshold"},
                "voice:jhadina:canonical:v1",
            )
        self.assertEqual(artifact.audio_bytes,b"RIFF")
        self.assertEqual(artifact.mime_type,"audio/wav")
        self.assertEqual(artifact.model_id,"qwen3-tts-model")
        self.assertEqual(artifact.provider_voice_ref,"jhadina-v1")
        self.assertEqual(artifact.provider_task_id,"provider-task-1")
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
            engine=FakeTts("qwen3-tts",True)
            router=VoiceRouter([],[engine],identity_policy=policy)
            with self.assertRaisesRegex(RuntimeError,"JHADINA_VOICE_IDENTITY_RUNTIME_BLOCKED"):
                router.speak("hello","en-US")
            self.assertEqual(engine.calls,[])
            audition=router.audition("hello","en-US")
            self.assertTrue(audition["candidateUnapproved"])
            self.assertEqual(audition["approvalState"],"candidate_unapproved")
            self.assertFalse(audition["qualityClaim"])
            self.assertEqual(len(engine.calls),1)

    def test_low_similarity_provider_fails_over_to_identity_preserving_provider(self):
        reference_bytes=b"canonical-jhadina-reference"
        with tempfile.TemporaryDirectory() as directory:
            reference_path=Path(directory)/"reference.wav"
            reference_path.write_bytes(reference_bytes)
            reference_sha=hashlib.sha256(reference_bytes).hexdigest()
            approval_path=write_approval_receipt(directory,reference_sha)
            policy=VoiceIdentityRuntimePolicy(
                status="approved",
                approval_receipt_id="approval:jhadina:v1",
                approval_receipt_path=approval_path,
                reference_audio_path=str(reference_path),
                reference_mime_type="audio/wav",
                reference_sha256=reference_sha,
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
        with tempfile.TemporaryDirectory() as directory:
            reference_path=Path(directory)/"reference.wav"
            reference_path.write_bytes(reference_bytes)
            reference_sha=hashlib.sha256(reference_bytes).hexdigest()
            approval_path=write_approval_receipt(directory,reference_sha)
            policy=VoiceIdentityRuntimePolicy(
                status="approved",
                approval_receipt_id="approval:jhadina:v1",
                approval_receipt_path=approval_path,
                reference_audio_path=str(reference_path),
                reference_sha256=reference_sha,
                minimum_speaker_similarity=0.80,
            )
            router=VoiceRouter(
                [],
                [FakeTts("qwen3-tts",True)],
                identity_policy=policy,
                speaker_qc=None,
            )
            with self.assertRaisesRegex(RuntimeError,"JHADINA_SPEAKER_QC_REQUIRED"):
                router.speak("hello","en-US")


    def test_approved_identity_rejects_receipt_reference_or_id_mismatch(self):
        reference_bytes=b"canonical-jhadina-reference"
        with tempfile.TemporaryDirectory() as directory:
            reference_path=Path(directory)/"reference.wav"
            reference_path.write_bytes(reference_bytes)
            reference_sha=hashlib.sha256(reference_bytes).hexdigest()
            approval_path=write_approval_receipt(directory,"a"*64)
            policy=VoiceIdentityRuntimePolicy(
                status="approved",
                approval_receipt_id="approval:jhadina:v1",
                approval_receipt_path=approval_path,
                reference_audio_path=str(reference_path),
                reference_sha256=reference_sha,
                minimum_speaker_similarity=0.80,
            )
            self.assertIn(
                "JHADINA_VOICE_APPROVAL_RECEIPT_REFERENCE_MISMATCH",
                policy.readiness_reasons(),
            )

            approval_path=write_approval_receipt(directory,reference_sha,"approval:other")
            policy=VoiceIdentityRuntimePolicy(
                status="approved",
                approval_receipt_id="approval:jhadina:v1",
                approval_receipt_path=approval_path,
                reference_audio_path=str(reference_path),
                reference_sha256=reference_sha,
                minimum_speaker_similarity=0.80,
            )
            self.assertIn(
                "JHADINA_VOICE_APPROVAL_RECEIPT_ID_MISMATCH",
                policy.readiness_reasons(),
            )


    def test_http_speaker_qc_forwards_bearer_and_validates_verification_receipt(self):
        reference=b"reference"
        candidate=b"candidate"
        payload={
            "similarity":0.91,
            "modelId":DEFAULT_SPEAKER_QC_MODEL_ID,
            "modelRevision":DEFAULT_SPEAKER_QC_MODEL_REVISION,
            "referenceSha256":hashlib.sha256(reference).hexdigest(),
            "candidateSha256":hashlib.sha256(candidate).hexdigest(),
            "referenceDurationSeconds":8.0,
            "candidateDurationSeconds":7.0,
            "qualityClaim":False,
        }
        captured={}
        def fake_urlopen(request,timeout=0):
            captured["url"]=request.full_url
            captured["headers"]=dict(request.header_items())
            captured["body"]=json.loads(request.data.decode())
            captured["timeout"]=timeout
            return FakeResponse(payload)

        verifier=AuthenticatedHttpSpeakerQcVerifier("https://speaker.example/","qc-secret")
        with patch("worker.urllib.request.urlopen",side_effect=fake_urlopen):
            receipt=verifier.verify(reference,"audio/wav",candidate,"audio/wav")
        self.assertAlmostEqual(receipt["similarity"],0.91)
        self.assertEqual(captured["url"],"https://speaker.example/v1/verify")
        self.assertEqual(captured["headers"].get("Authorization"),"Bearer qc-secret")
        self.assertEqual(base64.b64decode(captured["body"]["referenceAudioBase64"]),reference)
        self.assertEqual(base64.b64decode(captured["body"]["candidateAudioBase64"]),candidate)

    def test_http_speaker_qc_rejects_quality_claim_or_malformed_similarity(self):
        verifier=AuthenticatedHttpSpeakerQcVerifier("https://speaker.example","qc-secret")
        malformed={
            "similarity":"high",
            "modelId":DEFAULT_SPEAKER_QC_MODEL_ID,
            "modelRevision":DEFAULT_SPEAKER_QC_MODEL_REVISION,
            "referenceSha256":"a"*64,
            "candidateSha256":"b"*64,
            "qualityClaim":False,
        }
        with patch("worker.urllib.request.urlopen",return_value=FakeResponse(malformed)):
            with self.assertRaisesRegex(RuntimeError,"VERIFY_RECEIPT_INVALID"):
                verifier.verify(b"a","audio/wav",b"b","audio/wav")

        false_authority={**malformed,"similarity":0.9,"qualityClaim":True}
        with patch("worker.urllib.request.urlopen",return_value=FakeResponse(false_authority)):
            with self.assertRaisesRegex(RuntimeError,"QUALITY_CLAIM_INVALID"):
                verifier.verify(b"a","audio/wav",b"b","audio/wav")


if __name__=="__main__":
    unittest.main()
