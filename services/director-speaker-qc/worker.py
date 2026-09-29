"""Provider-independent speaker fingerprint and similarity worker for Director."""
from __future__ import annotations

from array import array
from dataclasses import dataclass
from hashlib import sha256
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave
from typing import Protocol, Sequence

MODEL_ID="speechbrain/spkrec-ecapa-voxceleb"
MODEL_REVISION="ff989f88e92ccc120569763824f8eedd5afc9039"
SAMPLE_RATE_HZ=16_000
MAX_AUDIO_BYTES=25*1024*1024
MIN_AUDIO_SECONDS=1.0
QUANTIZATION="l2-int16-v1"

@dataclass(frozen=True)
class SpeakerQcConfig:
    model_id:str=MODEL_ID
    model_revision:str=MODEL_REVISION
    cache_dir:Path=Path("/models/director-speaker-qc")
    device:str="auto"

    @classmethod
    def from_env(cls)->"SpeakerQcConfig":
        return cls(
            model_id=os.getenv("DIRECTOR_SPEAKER_QC_MODEL_ID",MODEL_ID).strip() or MODEL_ID,
            model_revision=os.getenv("DIRECTOR_SPEAKER_QC_MODEL_REVISION",MODEL_REVISION).strip() or MODEL_REVISION,
            cache_dir=Path(os.getenv("DIRECTOR_SPEAKER_QC_CACHE_DIR","/models/director-speaker-qc")),
            device=os.getenv("DIRECTOR_SPEAKER_QC_DEVICE","auto").strip() or "auto",
        )

class SpeakerEmbeddingBackend(Protocol):
    def ensure_ready(self)->None: ...
    def embed_wav(self,wav_bytes:bytes)->Sequence[float]: ...

def _ffmpeg_path()->str|None:
    return shutil.which("ffmpeg")

def runtime_readiness(config:SpeakerQcConfig,load_model:bool=False,backend:SpeakerEmbeddingBackend|None=None)->dict:
    ffmpeg=_ffmpeg_path()
    reasons=[]
    if not ffmpeg:
        reasons.append("DIRECTOR_SPEAKER_QC_FFMPEG_REQUIRED")
    if not config.model_id:
        reasons.append("DIRECTOR_SPEAKER_QC_MODEL_ID_REQUIRED")
    if not config.model_revision:
        reasons.append("DIRECTOR_SPEAKER_QC_MODEL_REVISION_REQUIRED")
    model_ready=None
    if load_model and not reasons:
        try:
            (backend or SpeechBrainEcapaBackend(config)).ensure_ready()
            model_ready=True
        except Exception as exc:
            model_ready=False
            reasons.append("DIRECTOR_SPEAKER_QC_MODEL_LOAD_FAILED:"+str(exc)[:200])
    return {
        "productionReady":not reasons and (model_ready is not False),
        "reasons":reasons,
        "ffmpegReady":bool(ffmpeg),
        "modelId":config.model_id,
        "modelRevision":config.model_revision,
        "modelReady":model_ready,
        "sampleRateHz":SAMPLE_RATE_HZ,
        "quantization":QUANTIZATION,
    }

def normalize_audio(audio_bytes:bytes,mime_type:str)->bytes:
    if not audio_bytes:
        raise ValueError("DIRECTOR_SPEAKER_QC_AUDIO_EMPTY")
    if len(audio_bytes)>MAX_AUDIO_BYTES:
        raise ValueError("DIRECTOR_SPEAKER_QC_AUDIO_TOO_LARGE")
    ffmpeg=_ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError("DIRECTOR_SPEAKER_QC_FFMPEG_REQUIRED")
    suffix={
        "audio/wav":".wav",
        "audio/mpeg":".mp3",
        "audio/mp4":".m4a",
        "audio/webm":".webm",
        "audio/flac":".flac",
    }.get(mime_type,".bin")
    with tempfile.TemporaryDirectory(prefix="director-speaker-qc-") as temp:
        source=Path(temp)/("source"+suffix)
        normalized=Path(temp)/"normalized.wav"
        source.write_bytes(audio_bytes)
        completed=subprocess.run(
            [ffmpeg,"-v","error","-y","-i",str(source),"-ac","1","-ar",str(SAMPLE_RATE_HZ),"-c:a","pcm_s16le",str(normalized)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=60,
            check=False,
        )
        if completed.returncode!=0 or not normalized.is_file():
            detail=completed.stderr.decode(errors="replace")[-300:]
            raise ValueError("DIRECTOR_SPEAKER_QC_AUDIO_NORMALIZE_FAILED:"+detail)
        data=normalized.read_bytes()
        if not data:
            raise ValueError("DIRECTOR_SPEAKER_QC_AUDIO_NORMALIZE_EMPTY")
        return data

def wav_samples(wav_bytes:bytes)->tuple[list[float],float]:
    import io
    with wave.open(io.BytesIO(wav_bytes),"rb") as handle:
        if handle.getnchannels()!=1 or handle.getsampwidth()!=2 or handle.getframerate()!=SAMPLE_RATE_HZ:
            raise ValueError("DIRECTOR_SPEAKER_QC_WAV_CONTRACT_INVALID")
        frames=handle.readframes(handle.getnframes())
        duration=handle.getnframes()/float(handle.getframerate())
    if duration<MIN_AUDIO_SECONDS:
        raise ValueError("DIRECTOR_SPEAKER_QC_AUDIO_TOO_SHORT")
    pcm=array("h")
    pcm.frombytes(frames)
    if sys.byteorder!="little":
        pcm.byteswap()
    return [sample/32768.0 for sample in pcm],duration

def _unit(values:Sequence[float])->list[float]:
    floats=[float(value) for value in values]
    norm=math.sqrt(sum(value*value for value in floats))
    if not floats or not math.isfinite(norm) or norm<=0:
        raise ValueError("DIRECTOR_SPEAKER_QC_EMBEDDING_INVALID")
    return [value/norm for value in floats]

def quantized_embedding_sha256(values:Sequence[float])->tuple[str,int]:
    unit=_unit(values)
    packed=array("h",[
        max(-32767,min(32767,int(round(value*32767.0))))
        for value in unit
    ])
    if sys.byteorder!="little":
        packed.byteswap()
    return sha256(packed.tobytes()).hexdigest(),len(unit)

def cosine_similarity(left:Sequence[float],right:Sequence[float])->float:
    a=_unit(left)
    b=_unit(right)
    if len(a)!=len(b):
        raise ValueError("DIRECTOR_SPEAKER_QC_EMBEDDING_DIMENSION_MISMATCH")
    score=sum(x*y for x,y in zip(a,b))
    return max(-1.0,min(1.0,float(score)))

class SpeechBrainEcapaBackend:
    def __init__(self,config:SpeakerQcConfig):
        self.config=config
        self._model=None
        self._torch=None

    def ensure_ready(self)->None:
        if self._model is not None:
            return
        import torch
        from huggingface_hub import snapshot_download
        from speechbrain.inference.speaker import SpeakerRecognition
        device=self.config.device
        if device=="auto":
            device="cuda" if torch.cuda.is_available() else "cpu"
        self.config.cache_dir.mkdir(parents=True,exist_ok=True)
        snapshot_path=snapshot_download(
            repo_id=self.config.model_id,
            revision=self.config.model_revision,
            local_dir=str(self.config.cache_dir/"snapshot"),
        )
        self._model=SpeakerRecognition.from_hparams(
            source=snapshot_path,
            savedir=str(self.config.cache_dir/"speechbrain"),
            overrides={"pretrained_path":snapshot_path},
            run_opts={"device":device},
        )
        self._torch=torch

    def embed_wav(self,wav_bytes:bytes)->Sequence[float]:
        self.ensure_ready()
        assert self._model is not None and self._torch is not None
        samples,_=wav_samples(wav_bytes)
        waveform=self._torch.tensor(samples,dtype=self._torch.float32).unsqueeze(0)
        with self._torch.no_grad():
            embedding=self._model.encode_batch(waveform)
        return embedding.detach().cpu().reshape(-1).tolist()

def fingerprint_audio(
    audio_bytes:bytes,
    mime_type:str,
    backend:SpeakerEmbeddingBackend,
    config:SpeakerQcConfig,
    expected_source_sha256:str|None=None,
)->dict:
    source_sha=sha256(audio_bytes).hexdigest()
    if expected_source_sha256 and source_sha.lower()!=expected_source_sha256.lower():
        raise ValueError("DIRECTOR_SPEAKER_QC_SOURCE_HASH_MISMATCH")
    normalized=normalize_audio(audio_bytes,mime_type)
    _,duration=wav_samples(normalized)
    embedding=backend.embed_wav(normalized)
    embedding_sha,dimensions=quantized_embedding_sha256(embedding)
    fingerprint_ref=(
        "speaker-embedding:ecapa-voxceleb:"
        +config.model_revision[:12]+":sha256:"+embedding_sha
    )
    return {
        "sourceSha256":source_sha,
        "normalizedAudioSha256":sha256(normalized).hexdigest(),
        "modelId":config.model_id,
        "modelRevision":config.model_revision,
        "embeddingDimensions":dimensions,
        "embeddingSha256":embedding_sha,
        "fingerprintRef":fingerprint_ref,
        "quantization":QUANTIZATION,
        "sampleRateHz":SAMPLE_RATE_HZ,
        "durationSeconds":duration,
        "qualityClaim":False,
    }

def verify_audio_pair(
    reference_bytes:bytes,
    reference_mime_type:str,
    candidate_bytes:bytes,
    candidate_mime_type:str,
    backend:SpeakerEmbeddingBackend,
    config:SpeakerQcConfig,
)->dict:
    reference=normalize_audio(reference_bytes,reference_mime_type)
    candidate=normalize_audio(candidate_bytes,candidate_mime_type)
    _,reference_duration=wav_samples(reference)
    _,candidate_duration=wav_samples(candidate)
    reference_embedding=backend.embed_wav(reference)
    candidate_embedding=backend.embed_wav(candidate)
    return {
        "similarity":cosine_similarity(reference_embedding,candidate_embedding),
        "modelId":config.model_id,
        "modelRevision":config.model_revision,
        "referenceSha256":sha256(reference_bytes).hexdigest(),
        "candidateSha256":sha256(candidate_bytes).hexdigest(),
        "referenceDurationSeconds":reference_duration,
        "candidateDurationSeconds":candidate_duration,
        "qualityClaim":False,
    }
