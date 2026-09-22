import base64
import unittest
from unittest.mock import patch, Mock
from worker import VoiceRouter, normalize_audio

class FailingAsr:
    id="asr-one"
    def transcribe(self,*_): raise RuntimeError("offline")
class WorkingAsr:
    id="asr-two"
    def transcribe(self,*_): return {"language":"en","text":"hello","segments":[]}
class FailingTts:
    id="tts-one"
    def supports(self,_): return True
    def synthesize(self,*_): raise RuntimeError("offline")
class WorkingTts:
    id="tts-two"
    def supports(self,_): return True
    def synthesize(self,*_): return b"RIFF"

class VoiceRuntimeTests(unittest.TestCase):
    @patch("worker.normalize_audio",return_value=b"wav")
    def test_asr_fails_over(self,_):
        result=VoiceRouter([FailingAsr(),WorkingAsr()],[]).transcribe(b"x","audio/wav")
        self.assertEqual(result["provider"],"asr-two")
    def test_tts_fails_over_and_preserves_identity(self):
        result=VoiceRouter([], [FailingTts(),WorkingTts()]).speak("hello","en-US")
        self.assertEqual(result["provider"],"tts-two")
        self.assertEqual(result["voiceProfileId"],"jhadina:canonical")
    def test_rejects_noncanonical_identity(self):
        with self.assertRaisesRegex(ValueError,"VOICE_IDENTITY_NOT_ADMITTED"):
            VoiceRouter([],[]).speak("hello","en-US","someone-else")

if __name__=="__main__": unittest.main()
