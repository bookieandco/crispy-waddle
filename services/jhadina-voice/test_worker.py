import base64
import json
import unittest
from unittest.mock import patch

from worker import AuthenticatedHttpTtsEngine, VoiceRouter, split_speech_chunks


class FakeTts:
    def __init__(self, engine_id, succeeds):
        self.id=engine_id
        self.succeeds=succeeds
        self.calls=[]
    def supports(self, _language):
        return True
    def synthesize(self, text, _language, _profile, delivery=None):
        self.calls.append((text,delivery))
        if not self.succeeds:
            raise RuntimeError("provider offline")
        return b"RIFF-jhadina"


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
        self.assertEqual(base64.b64decode(result["audioBase64"]),b"RIFF-jhadina")

    def test_noncanonical_voice_identity_is_rejected(self):
        router=VoiceRouter([],[FakeTts("qwen3-tts",True)])
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            router.speak("hello","en-US","someone-else")

    def test_progressive_stream_yields_audio_chunks_then_done(self):
        engine=FakeTts("voxcpm2",True)
        router=VoiceRouter([],[engine])
        events=list(router.speak_stream(
            "One sentence. Two sentence. Three sentence.",
            "en-US",
            "jhadina:canonical",
            {"style":"playful"},
            max_chars=20,
        ))
        self.assertGreaterEqual(len(events),3)
        self.assertTrue(all(event["type"]=="audio" for event in events[:-1]))
        self.assertEqual(events[-1]["type"],"done")
        self.assertEqual(events[-1]["count"],len(events)-1)
        self.assertTrue(all(call[1]=={"style":"playful"} for call in engine.calls))

    def test_chunker_is_bounded_and_nonempty(self):
        chunks=split_speech_chunks(
            "First sentence. Second sentence is much longer, because it should be split before progressive playback stalls.",
            80,
        )
        self.assertTrue(chunks)
        self.assertTrue(all(chunk and len(chunk)<=80 for chunk in chunks))

    def test_http_provider_requires_canonical_profile_and_wav_and_forwards_delivery(self):
        engine=AuthenticatedHttpTtsEngine("qwen3-tts","https://tts.example/speak","secret",["en-US"])
        payload={
            "voiceProfileId":"jhadina:canonical",
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
                ),
                b"RIFF",
            )
        self.assertEqual(captured["body"]["delivery"]["style"],"threshold")
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            engine.synthesize("hello","en-US","other")


if __name__=="__main__":
    unittest.main()
