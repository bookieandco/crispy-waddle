"""HTTP boundary for Jhadina native voice runtime."""
import base64, os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from worker import AuthenticatedHttpTtsEngine, FasterWhisperEngine, VoiceRouter

app=FastAPI(title="Jhadina Voice",version="1.0")
_router:VoiceRouter|None=None

class ListenRequest(BaseModel):
    mimeType:str
    audioBase64:str=Field(min_length=1,max_length=40_000_000)
    languageHint:str|None=None
class SpeakRequest(BaseModel):
    text:str=Field(min_length=1,max_length=8000)
    language:str=Field(min_length=2,max_length=35)
    voiceProfileId:str="jhadina:canonical"

def router()->VoiceRouter:
    global _router
    if _router is None:
        tts=[]
        for engine_id,prefix in [("qwen3-tts","JHADINA_QWEN3_TTS"),("voxcpm2","JHADINA_VOXCPM2_TTS")]:
            endpoint=os.getenv(f"{prefix}_URL","").strip()
            token=os.getenv(f"{prefix}_TOKEN","").strip()
            languages=[value.strip() for value in os.getenv(f"{prefix}_LANGUAGES","").split(",") if value.strip()]
            if endpoint and token:
                tts.append(AuthenticatedHttpTtsEngine(engine_id,endpoint,token,languages))
        _router=VoiceRouter(
            [FasterWhisperEngine(os.getenv("JHADINA_WHISPER_MODEL","small"),os.getenv("JHADINA_WHISPER_DEVICE","auto"),os.getenv("JHADINA_WHISPER_COMPUTE","int8"))],
            tts,
        )
    return _router

@app.get("/health")
def health():
    configured=[engine.id for engine in router().tts]
    return {
        "status":"ready" if len(configured)>=2 else "degraded",
        "asr":["faster-whisper"],
        "tts":configured,
        "nativeTtsRequired":2,
        "canonicalVoiceProfile":"jhadina:canonical",
    }

@app.post("/v1/listen")
def listen(body:ListenRequest):
    try:
        audio=base64.b64decode(body.audioBase64,validate=True)
        return router().transcribe(audio,body.mimeType,body.languageHint)
    except Exception as exc:
        raise HTTPException(status_code=503,detail=str(exc)[:300])

@app.post("/v1/speak")
def speak(body:SpeakRequest):
    try:return router().speak(body.text,body.language,body.voiceProfileId)
    except Exception as exc:raise HTTPException(status_code=503,detail=str(exc)[:300])
