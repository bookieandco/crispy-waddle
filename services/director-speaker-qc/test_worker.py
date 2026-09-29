import importlib.util
import io
import struct
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
import wave

root=Path(__file__).parent
spec=importlib.util.spec_from_file_location("director_speaker_qc_worker",root/"worker.py")
if spec is None or spec.loader is None:
    raise ImportError("director speaker qc worker spec unavailable")
worker=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=worker
spec.loader.exec_module(worker)

class FakeBackend:
    def __init__(self,embedding):
        self.embedding=embedding
        self.ready=False
    def ensure_ready(self):
        self.ready=True
    def embed_wav(self,wav_bytes):
        return list(self.embedding)

def wav(samples=None):
    samples=samples or [1000,-1000]*16000
    buffer=io.BytesIO()
    with wave.open(buffer,"wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(worker.SAMPLE_RATE_HZ)
        out.writeframes(struct.pack("<"+"h"*len(samples),*samples))
    return buffer.getvalue()

class SpeakerQcWorkerTest(unittest.TestCase):
    def test_quantized_fingerprint_is_scale_invariant(self):
        a=worker.quantized_embedding_sha256([1.0,2.0,3.0])
        b=worker.quantized_embedding_sha256([10.0,20.0,30.0])
        self.assertEqual(a,b)
        self.assertEqual(a[1],3)

    def test_cosine_similarity_preserves_identity_geometry(self):
        self.assertAlmostEqual(worker.cosine_similarity([1,0],[1,0]),1.0,places=6)
        self.assertAlmostEqual(worker.cosine_similarity([1,0],[0,1]),0.0,places=6)
        self.assertAlmostEqual(worker.cosine_similarity([1,0],[-1,0]),-1.0,places=6)

    def test_fingerprint_binds_source_hash_and_embedding_model(self):
        source=b"source-audio"
        normalized=wav()
        backend=FakeBackend([0.25,0.5,0.75])
        config=worker.SpeakerQcConfig(cache_dir=worker.Path("/tmp/unused"))
        with patch.object(worker,"normalize_audio",return_value=normalized):
            result=worker.fingerprint_audio(source,"audio/mpeg",backend,config)
        self.assertEqual(result["sourceSha256"],worker.sha256(source).hexdigest())
        self.assertEqual(result["embeddingDimensions"],3)
        self.assertEqual(result["modelId"],worker.MODEL_ID)
        self.assertEqual(result["modelRevision"],worker.MODEL_REVISION)
        self.assertTrue(result["fingerprintRef"].startswith("speaker-embedding:ecapa-voxceleb:"))
        self.assertFalse(result["qualityClaim"])

    def test_fingerprint_rejects_source_hash_mismatch(self):
        backend=FakeBackend([1,2,3])
        config=worker.SpeakerQcConfig(cache_dir=worker.Path("/tmp/unused"))
        with self.assertRaisesRegex(ValueError,"SOURCE_HASH_MISMATCH"):
            worker.fingerprint_audio(b"audio","audio/mpeg",backend,config,"0"*64)

    def test_pair_verification_uses_acoustic_embeddings_not_file_hashes(self):
        normalized=wav()
        class PairBackend:
            def __init__(self):
                self.calls=0
            def ensure_ready(self): pass
            def embed_wav(self,_):
                self.calls+=1
                return [1.0,0.0] if self.calls==1 else [0.8,0.6]
        backend=PairBackend()
        config=worker.SpeakerQcConfig(cache_dir=worker.Path("/tmp/unused"))
        with patch.object(worker,"normalize_audio",return_value=normalized):
            result=worker.verify_audio_pair(b"a","audio/mpeg",b"b","audio/mpeg",backend,config)
        self.assertAlmostEqual(result["similarity"],0.8,places=6)
        self.assertNotEqual(result["referenceSha256"],result["candidateSha256"])
        self.assertFalse(result["qualityClaim"])

    def test_readiness_can_certify_injected_backend_without_loading_model(self):
        backend=FakeBackend([1,0])
        config=worker.SpeakerQcConfig(cache_dir=worker.Path("/tmp/unused"))
        with patch.object(worker,"_ffmpeg_path",return_value="/usr/bin/ffmpeg"):
            result=worker.runtime_readiness(config,load_model=True,backend=backend)
        self.assertTrue(result["productionReady"])
        self.assertTrue(result["modelReady"])
        self.assertTrue(backend.ready)

if __name__=="__main__":
    unittest.main()
