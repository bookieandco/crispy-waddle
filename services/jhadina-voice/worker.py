"""Jhadina native voice service — provider-neutral ASR/TTS boundary.

Personality, memory, authorization and subsystem execution remain outside this service.
"""
from __future__ import annotations
import base64, subprocess, tempfile
from dataclasses import dataclass
from typing import Protocol

class AsrEngine(Protocol):
    id: str
    def transcribe(self, wav_path: str, language: str | None = None) -> dict: ...

class TtsEngine(Protocol):
    id: str
    def supports(self, language: str) -> bool: ...
    def synthesize(self, text: str, language: str, voice_profile_id: str) -> bytes: ...

def normalize_audio(payload: bytes, mime_type: str) -> bytes:
    if not payload: raise ValueError("VOICE_AUDIO_EMPTY")
    suffix={"audio/wav":".wav","audio/mpeg":".mp3","audio/mp4":".m4a","audio/webm":".webm"}.get(mime_type,".bin")
    with tempfile.NamedTemporaryFile(suffix=suffix) as src, tempfile.NamedTemporaryFile(suffix=".wav") as dst:
        src.write(payload); src.flush()
        proc=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",src.name,"-vn","-ac","1","-ar","16000","-c:a","pcm_s16le",dst.name],capture_output=True,timeout=60)
        if proc.returncode: raise RuntimeError("VOICE_FFMPEG_NORMALIZE_FAILED")
        return dst.read()

@dataclass
class VoiceRouter:
    asr: list[AsrEngine]
    tts: list[TtsEngine]

    def transcribe(self, audio: bytes, mime_type: str, language: str | None = None) -> dict:
        wav=normalize_audio(audio,mime_type)
        failures=[]
        with tempfile.NamedTemporaryFile(suffix=".wav") as f:
            f.write(wav); f.flush()
            for engine in self.asr:
                try:
                    result=engine.transcribe(f.name,language)
                    return {**result,"provider":engine.id}
                except Exception as exc:
                    failures.append(f"{engine.id}:{type(exc).__name__}")
        raise RuntimeError("VOICE_ASR_FAILED:"+"|".join(failures))

    def speak(self,text: str,language: str,voice_profile_id: str="jhadina:canonical") -> dict:
        if voice_profile_id != "jhadina:canonical": raise ValueError("VOICE_IDENTITY_NOT_ADMITTED")
        failures=[]
        for engine in self.tts:
            if not engine.supports(language): continue
            try:
                audio=engine.synthesize(text,language,voice_profile_id)
                return {"provider":engine.id,"mimeType":"audio/wav","audioBase64":base64.b64encode(audio).decode(),"voiceProfileId":voice_profile_id}
            except Exception as exc:
                failures.append(f"{engine.id}:{type(exc).__name__}")
        raise RuntimeError("VOICE_TTS_FAILED:"+"|".join(failures))


class FasterWhisperEngine:
    id = "faster-whisper"
    def __init__(self, model_size: str = "small", device: str = "auto", compute_type: str = "int8"):
        from faster_whisper import WhisperModel
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, wav_path: str, language: str | None = None) -> dict:
        segments, info = self.model.transcribe(
            wav_path,
            language=(language.split("-")[0] if language else None),
            vad_filter=True,
            word_timestamps=True,
        )
        rows=[]; text=[]
        for seg in segments:
            value=seg.text.strip()
            if value: text.append(value)
            rows.append({"startMs":round(seg.start*1000),"endMs":round(seg.end*1000),"text":value})
        return {"language":getattr(info,"language",language or "und"),"text":" ".join(text),"segments":rows}
