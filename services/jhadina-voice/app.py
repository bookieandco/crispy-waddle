"""HTTP boundary for Jhadina native voice runtime."""
import base64, os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
from worker import FasterWhisperEngine, VoiceRouter

app=FastAPI(title="Jhadina Voice",version="1.0")
_router:VoiceRouter|None=None
_ALLOWED_MIME={"audio/wav","audio/x-wav","audio/mpeg","audio/mp4","audio/webm"}
_MAX_AUDIO_BYTES=25_000_000
_SERVICE_TOKEN=os.getenv("JHADINA_VOICE_SERVICE_TOKEN")

class ListenRequest(BaseModel):
    mimeType:str
    audioBase64:str=Field(min_length=1,max_length=40_000_000)
    languageHint:str|None=None
class SpeakRequest(BaseModel):
    text:str=Field(min_length=1,max_length=8000)
    language:str=Field(min_length=2,max_length=35)
    voiceProfileId:str="jhadina:canonical"

def authorize(authorization:str|None)->None:
    if not _SERVICE_TOKEN: raise HTTPException(status_code=503,detail="VOICE_SERVICE_TOKEN_NOT_CONFIGURED")
    if authorization != f"Bearer {_SERVICE_TOKEN}": raise HTTPException(status_code=401,detail="VOICE_SERVICE_UNAUTHORIZED")

def router()->VoiceRouter:
    global _router
    if _router is None:
        _router=VoiceRouter(
            [FasterWhisperEngine(os.getenv("JHADINA_WHISPER_MODEL","small"),os.getenv("JHADINA_WHISPER_DEVICE","auto"),os.getenv("JHADINA_WHISPER_COMPUTE","int8"))],
            [],
        )
    return _router

@app.get("/health")
def health():
    return {"status":"ready","asr":["faster-whisper"],"tts":[],"canonicalVoiceProfile":"jhadina:canonical"}

@app.post("/v1/listen")
def listen(body:ListenRequest,authorization:str|None=Header(default=None)):
    authorize(authorization)
    try:
        if body.mimeType not in _ALLOWED_MIME: raise ValueError("VOICE_MIME_NOT_ADMITTED")
        audio=base64.b64decode(body.audioBase64,validate=True)
        if len(audio)>_MAX_AUDIO_BYTES: raise ValueError("VOICE_AUDIO_TOO_LARGE")
        return router().transcribe(audio,body.mimeType,body.languageHint)
    except Exception as exc:
        raise HTTPException(status_code=503,detail=str(exc)[:300])

@app.post("/v1/speak")
def speak(body:SpeakRequest,authorization:str|None=Header(default=None)):
    authorize(authorization)
    try:return router().speak(body.text,body.language,body.voiceProfileId)
    except Exception as exc:raise HTTPException(status_code=503,detail=str(exc)[:300])
