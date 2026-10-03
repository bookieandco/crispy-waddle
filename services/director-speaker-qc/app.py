"""HTTP boundary for Director speaker fingerprint / similarity QC."""
import base64
import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from vercel_oidc import authorize_vercel_token
from worker import (
    MAX_AUDIO_BYTES,
    SpeakerQcConfig,
    SpeechBrainEcapaBackend,
    fingerprint_audio,
    runtime_readiness,
    verify_audio_pair,
)

app=FastAPI(title="Director Speaker QC",version="1.0")
_config=SpeakerQcConfig.from_env()
_backend:SpeechBrainEcapaBackend|None=None

class FingerprintRequest(BaseModel):
    mimeType:str=Field(min_length=5,max_length=100)
    audioBase64:str=Field(min_length=1,max_length=40_000_000)
    expectedSourceSha256:str|None=None

class VerifyRequest(BaseModel):
    referenceMimeType:str=Field(min_length=5,max_length=100)
    referenceAudioBase64:str=Field(min_length=1,max_length=40_000_000)
    candidateMimeType:str=Field(min_length=5,max_length=100)
    candidateAudioBase64:str=Field(min_length=1,max_length=40_000_000)

def _authorize(authorization:str|None)->None:
    supplied=authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    if not supplied:
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")
    expected=os.getenv("DIRECTOR_SPEAKER_QC_TOKEN","").strip()
    if expected and hmac.compare_digest(supplied,expected):
        return
    if authorize_vercel_token(supplied):
        return
    raise HTTPException(status_code=401,detail="UNAUTHORIZED")

def _decode(value:str)->bytes:
    try:
        data=base64.b64decode(value,validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400,detail="DIRECTOR_SPEAKER_QC_BASE64_INVALID") from exc
    if not data:
        raise HTTPException(status_code=400,detail="DIRECTOR_SPEAKER_QC_AUDIO_EMPTY")
    if len(data)>MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413,detail="DIRECTOR_SPEAKER_QC_AUDIO_TOO_LARGE")
    return data

def backend()->SpeechBrainEcapaBackend:
    global _backend
    if _backend is None:
        _backend=SpeechBrainEcapaBackend(_config)
    return _backend

@app.get("/health/live")
def live():
    return {"status":"live","service":"director-speaker-qc"}

@app.get("/health")
def health():
    readiness=runtime_readiness(_config,load_model=True,backend=backend())
    return {
        "status":"ready" if readiness["productionReady"] else "blocked",
        **readiness,
    }

@app.post("/v1/fingerprint")
def fingerprint(body:FingerprintRequest,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    try:
        return fingerprint_audio(
            _decode(body.audioBase64),
            body.mimeType,
            backend(),
            _config,
            body.expectedSourceSha256,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)[:300]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503,detail=str(exc)[:300]) from exc

@app.post("/v1/verify")
def verify(body:VerifyRequest,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    try:
        return verify_audio_pair(
            _decode(body.referenceAudioBase64),
            body.referenceMimeType,
            _decode(body.candidateAudioBase64),
            body.candidateMimeType,
            backend(),
            _config,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)[:300]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503,detail=str(exc)[:300]) from exc
