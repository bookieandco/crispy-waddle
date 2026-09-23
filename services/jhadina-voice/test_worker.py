import base64
import io
import json
import unittest
from unittest.mock import patch

from worker import AuthenticatedHttpTtsEngine, VoiceRouter


class FakeTts:
    def __init__(self, engine_id, succeeds):
        self.id=engine_id
        self.succeeds=succeeds
    def supports(self, _language):
        return True
    def synthesize(self, _text, _language, _profile):
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
        result=router.speak("hello","en-US","jhadina:canonical")
        self.assertEqual(result["provider"],"voxcpm2")
        self.assertEqual(result["voiceProfileId"],"jhadina:canonical")
        self.assertEqual(base64.b64decode(result["audioBase64"]),b"RIFF-jhadina")

    def test_noncanonical_voice_identity_is_rejected(self):
        router=VoiceRouter([],[FakeTts("qwen3-tts",True)])
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            router.speak("hello","en-US","someone-else")

    def test_http_provider_requires_canonical_profile_and_wav(self):
        engine=AuthenticatedHttpTtsEngine("qwen3-tts","https://tts.example/speak","secret",["en-US"])
        payload={
            "voiceProfileId":"jhadina:canonical",
            "mimeType":"audio/wav",
            "audioBase64":base64.b64encode(b"RIFF").decode(),
        }
        with patch("worker.urllib.request.urlopen",return_value=FakeResponse(payload)):
            self.assertEqual(engine.synthesize("hello","en-US","jhadina:canonical"),b"RIFF")
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            engine.synthesize("hello","en-US","other")


if __name__=="__main__":
    unittest.main()
