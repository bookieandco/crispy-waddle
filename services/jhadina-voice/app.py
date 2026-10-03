"""HTTP boundary for Jhadina native voice runtime."""
import base64
import hmac
import json
import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Literal

from worker import (
    AuthenticatedHttpTtsEngine,
    FasterWhisperEngine,
    VoiceRouter,
    CANONICAL_VOICE_PROFILE_ID,
    CANONICAL_VOICE_IDENTITY_ID,
)

app=FastAPI(title="Jhadina Voice",version="1.2")
_router:VoiceRouter|None=None
MAX_AUDIO_BYTES=int(os.getenv("JHADINA_VOICE_MAX_AUDIO_BYTES",str(25*1024*1024)))
ALLOWED_AUDIO_MIME={"audio/wav","audio/mpeg","audio/mp4","audio/webm"}

class ListenRequest(BaseModel):
    mimeType:str
    audioBase64:str=Field(min_length=1,max_length=40_000_000)
    languageHint:str|None=None

class DeliveryRequest(BaseModel):
    rate:float|None=Field(default=None,ge=0.5,le=2.0)
    pauseScale:float|None=Field(default=None,ge=0.5,le=2.0)
    emphasis:list[str]|None=None
    emphasisStrength:float|None=Field(default=None,ge=0,le=1)
    style:str|None=Field(default=None,max_length=64)
    microPauseDensity:float|None=Field(default=None,ge=0,le=1)
    thoughtPauseDurationMs:int|None=Field(default=None,ge=0,le=3000)
    pitchRange:float|None=Field(default=None,ge=0,le=1)
    pitchContour:Literal["level","gentle","dynamic"]|None=None
    energy:float|None=Field(default=None,ge=0,le=1)
    warmth:float|None=Field(default=None,ge=0,le=1)
    groundedConfidence:float|None=Field(default=None,ge=0,le=1)
    conversationality:float|None=Field(default=None,ge=0,le=1)
    intimacy:float|None=Field(default=None,ge=0,le=1)
    breathiness:float|None=Field(default=None,ge=0,le=1)
    sentenceFinality:float|None=Field(default=None,ge=0,le=1)
    spontaneity:float|None=Field(default=None,ge=0,le=1)
    reactionIntensity:float|None=Field(default=None,ge=0,le=1)
    playfulness:float|None=Field(default=None,ge=0,le=1)
    operationalSass:float|None=Field(default=None,ge=0,le=1)
    absurdEscalation:float|None=Field(default=None,ge=0,le=1)
    poeticCompression:float|None=Field(default=None,ge=0,le=1)
    storytellingIntensity:float|None=Field(default=None,ge=0,le=1)

class SpeakRequest(BaseModel):
    text:str=Field(min_length=1,max_length=8000)
    language:str=Field(min_length=2,max_length=35)
    voiceProfileId:str=CANONICAL_VOICE_PROFILE_ID
    voiceIdentityId:str=CANONICAL_VOICE_IDENTITY_ID
    delivery:DeliveryRequest|None=None

def _authorize(authorization:str|None)->None:
    expected=os.getenv("JHADINA_VOICE_TOKEN","")
    if not expected:
        raise HTTPException(status_code=503,detail="VOICE_TOKEN_NOT_CONFIGURED")
    supplied=authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied,expected):
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")

def _tts_engines()->list[AuthenticatedHttpTtsEngine]:
    tts=[]
    for engine_id,prefix in [("qwen3-tts","JHADINA_QWEN3_TTS"),("voxcpm2","JHADINA_VOXCPM2_TTS")]:
        endpoint=os.getenv(f"{prefix}_URL","").strip()
        token=os.getenv(f"{prefix}_TOKEN","").strip()
        languages=[value.strip() for value in os.getenv(f"{prefix}_LANGUAGES","").split(",") if value.strip()]
        if endpoint and token:
            tts.append(AuthenticatedHttpTtsEngine(engine_id,endpoint,token,languages))
    return tts

def router()->VoiceRouter:
    global _router
    if _router is None:
        _router=VoiceRouter(
            [
                FasterWhisperEngine(
                    os.getenv("JHADINA_WHISPER_MODEL","small"),
                    os.getenv("JHADINA_WHISPER_DEVICE","auto"),
                    os.getenv("JHADINA_WHISPER_COMPUTE","int8"),
                )
            ],
            _tts_engines(),
        )
    return _router

@app.get("/health")
def health():
    configured=[engine.id for engine in _tts_engines()]
    return {
        "status":"ready" if len(configured)>=2 else "degraded",
        "asr":["faster-whisper"],
        "tts":configured,
        "nativeTtsRequired":2,
        "streaming":"progressive-ndjson",
        "canonicalVoiceProfile":CANONICAL_VOICE_PROFILE_ID,
        "canonicalVoiceIdentity":CANONICAL_VOICE_IDENTITY_ID,
        "canonicalVoiceIdentityStatus":"candidate",
    }

@app.post("/v1/listen")
def listen(body:ListenRequest,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    if body.mimeType not in ALLOWED_AUDIO_MIME:
        raise HTTPException(status_code=415,detail="VOICE_AUDIO_MIME_NOT_ADMITTED")
    try:
        audio=base64.b64decode(body.audioBase64,validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400,detail="VOICE_AUDIO_BASE64_INVALID") from exc
    if not audio:
        raise HTTPException(status_code=400,detail="VOICE_AUDIO_EMPTY")
    if len(audio)>MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413,detail="VOICE_AUDIO_TOO_LARGE")
    try:
        return router().transcribe(audio,body.mimeType,body.languageHint)
    except Exception as exc:
        raise HTTPException(status_code=503,detail=str(exc)[:300]) from exc

@app.post("/v1/speak")
def speak(body:SpeakRequest,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    try:
        delivery=body.delivery.model_dump(exclude_none=True) if body.delivery else None
        return router().speak(body.text,body.language,body.voiceProfileId,delivery,body.voiceIdentityId)
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)[:300]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503,detail=str(exc)[:300]) from exc

@app.post("/v1/speak-stream")
def speak_stream(body:SpeakRequest,authorization:str|None=Header(default=None)):
    _authorize(authorization)

    def generate():
        try:
            for event in router().speak_stream(
                body.text,
                body.language,
                body.voiceProfileId,
                body.delivery.model_dump(exclude_none=True) if body.delivery else None,
                body.voiceIdentityId,
            ):
                yield json.dumps(event,separators=(",",":"))+"\n"
        except Exception as exc:
            yield json.dumps({
                "type":"error",
                "detail":str(exc)[:300],
                "voiceProfileId":body.voiceProfileId,
                "voiceIdentityId":body.voiceIdentityId,
            },separators=(",",":"))+"\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "cache-control":"no-store",
            "x-accel-buffering":"no",
        },
    )
