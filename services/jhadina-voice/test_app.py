import json
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import app


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

    def test_health_requires_two_native_tts_lanes_for_ready(self):
        with patch.dict(os.environ,{"JHADINA_QWEN3_TTS_URL":"https://qwen.example","JHADINA_QWEN3_TTS_TOKEN":"x"},clear=True):
            self.assertEqual(app.health()["status"],"degraded")
        with patch.dict(os.environ,{
            "JHADINA_QWEN3_TTS_URL":"https://qwen.example",
            "JHADINA_QWEN3_TTS_TOKEN":"x",
            "JHADINA_VOXCPM2_TTS_URL":"https://voxcpm.example",
            "JHADINA_VOXCPM2_TTS_TOKEN":"y",
        },clear=True):
            health=app.health()
            self.assertEqual(health["status"],"ready")
            self.assertEqual(set(health["tts"]),{"qwen3-tts","voxcpm2"})
            self.assertEqual(health["streaming"],"progressive-ndjson")

    def test_listen_rejects_unadmitted_mime_before_model_loading(self):
        with patch.dict(os.environ,{"JHADINA_VOICE_TOKEN":"secret"},clear=True):
            body=app.ListenRequest(mimeType="application/octet-stream",audioBase64="eA==")
            with self.assertRaises(HTTPException) as rejected:
                app.listen(body,"Bearer secret")
            self.assertEqual(rejected.exception.status_code,415)

    def test_stream_endpoint_preserves_canonical_identity_and_ndjson_contract(self):
        class FakeRouter:
            def speak_stream(self,text,language,voice_profile_id,delivery):
                self.args=(text,language,voice_profile_id,delivery)
                yield {
                    "type":"audio",
                    "index":0,
                    "count":1,
                    "mimeType":"audio/wav",
                    "audioBase64":"UklGRg==",
                    "provider":"voxcpm2",
                    "voiceProfileId":"jhadina:canonical",
                    "text":text,
                }
                yield {"type":"done","count":1,"voiceProfileId":"jhadina:canonical"}

        fake=FakeRouter()
        body=app.SpeakRequest(
            text="Hello there.",
            language="en-US",
            voiceProfileId="jhadina:canonical",
            delivery={"style":"playful","rate":1.08},
        )
        with patch.dict(os.environ,{"JHADINA_VOICE_TOKEN":"secret"},clear=True), patch("app.router",return_value=fake):
            response=app.speak_stream(body,"Bearer secret")
            lines=list(response.body_iterator)
        decoded=[json.loads(line.decode() if isinstance(line,bytes) else line) for line in lines]
        self.assertEqual(decoded[0]["type"],"audio")
        self.assertEqual(decoded[-1]["type"],"done")
        self.assertEqual(fake.args[2],"jhadina:canonical")
        self.assertEqual(fake.args[3]["style"],"playful")


if __name__=="__main__":
    unittest.main()
