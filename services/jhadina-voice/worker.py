"""Jhadina native voice service — provider-neutral ASR/TTS boundary.

Personality, memory, authorization and subsystem execution remain outside this service.
"""
from __future__ import annotations
import base64, json, re, subprocess, tempfile, urllib.request
from dataclasses import dataclass
from typing import Iterator, Protocol

class AsrEngine(Protocol):
    id: str
    def transcribe(self, wav_path: str, language: str | None = None) -> dict: ...

class TtsEngine(Protocol):
    id: str
    def supports(self, language: str) -> bool: ...
    def synthesize(
        self,
        text: str,
        language: str,
        voice_profile_id: str,
        delivery: dict | None = None,
    ) -> bytes: ...

def normalize_audio(payload: bytes, mime_type: str) -> bytes:
    if not payload:
        raise ValueError("VOICE_AUDIO_EMPTY")
    suffix={
        "audio/wav":".wav",
        "audio/mpeg":".mp3",
        "audio/mp4":".m4a",
        "audio/webm":".webm",
    }.get(mime_type,".bin")
    with tempfile.NamedTemporaryFile(suffix=suffix) as src, tempfile.NamedTemporaryFile(suffix=".wav") as dst:
        src.write(payload)
        src.flush()
        proc=subprocess.run(
            [
                "ffmpeg","-hide_banner","-loglevel","error","-y",
                "-i",src.name,"-vn","-ac","1","-ar","16000","-c:a","pcm_s16le",dst.name,
            ],
            capture_output=True,
            timeout=60,
        )
        if proc.returncode:
            raise RuntimeError("VOICE_FFMPEG_NORMALIZE_FAILED")
        return dst.read()

def split_speech_chunks(text: str, max_chars: int = 240) -> list[str]:
    """Bounded semantic chunks for progressive synthesis/playback."""
    normalized=" ".join(text.split()).strip()
    if not normalized:
        return []
    bounded=max(80,min(500,int(max_chars)))
    sentences=[value.strip() for value in re.findall(r"[^.!?]+[.!?]+|[^.!?]+$",normalized) if value.strip()]
    chunks:list[str]=[]
    current=""

    def flush()->None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current=""

    for sentence in sentences or [normalized]:
        if len(sentence)>bounded:
            flush()
            clauses=[value.strip() for value in re.split(r"(?<=[,;:])\s+",sentence) if value.strip()]
            clause_chunk=""
            for clause in clauses:
                candidate=f"{clause_chunk} {clause}".strip()
                if len(candidate)<=bounded:
                    clause_chunk=candidate
                    continue
                if clause_chunk:
                    chunks.append(clause_chunk)
                if len(clause)<=bounded:
                    clause_chunk=clause
                    continue
                for offset in range(0,len(clause),bounded):
                    piece=clause[offset:offset+bounded].strip()
                    if piece:
                        chunks.append(piece)
                clause_chunk=""
            if clause_chunk:
                chunks.append(clause_chunk)
            continue

        candidate=f"{current} {sentence}".strip()
        if len(candidate)<=bounded:
            current=candidate
        else:
            flush()
            current=sentence
    flush()
    return chunks[:64]

@dataclass
class VoiceRouter:
    asr: list[AsrEngine]
    tts: list[TtsEngine]

    def transcribe(self, audio: bytes, mime_type: str, language: str | None = None) -> dict:
        wav=normalize_audio(audio,mime_type)
        failures=[]
        with tempfile.NamedTemporaryFile(suffix=".wav") as f:
            f.write(wav)
            f.flush()
            for engine in self.asr:
                try:
                    result=engine.transcribe(f.name,language)
                    return {**result,"provider":engine.id}
                except Exception as exc:
                    failures.append(f"{engine.id}:{type(exc).__name__}")
        raise RuntimeError("VOICE_ASR_FAILED:"+"|".join(failures))

    def speak(
        self,
        text: str,
        language: str,
        voice_profile_id: str="jhadina:canonical",
        delivery: dict | None = None,
    ) -> dict:
        if voice_profile_id != "jhadina:canonical":
            raise ValueError("VOICE_IDENTITY_NOT_ADMITTED")
        failures=[]
        for engine in self.tts:
            if not engine.supports(language):
                continue
            try:
                audio=engine.synthesize(text,language,voice_profile_id,delivery)
                return {
                    "provider":engine.id,
                    "mimeType":"audio/wav",
                    "audioBase64":base64.b64encode(audio).decode(),
                    "voiceProfileId":voice_profile_id,
                }
            except Exception as exc:
                failures.append(f"{engine.id}:{type(exc).__name__}")
        raise RuntimeError("VOICE_TTS_FAILED:"+"|".join(failures))

    def speak_stream(
        self,
        text: str,
        language: str,
        voice_profile_id: str="jhadina:canonical",
        delivery: dict | None = None,
        max_chars: int = 240,
    ) -> Iterator[dict]:
        chunks=split_speech_chunks(text,max_chars)
        if not chunks:
            raise ValueError("VOICE_TEXT_EMPTY")
        for index,chunk in enumerate(chunks):
            result=self.speak(chunk,language,voice_profile_id,delivery)
            yield {
                "type":"audio",
                "index":index,
                "count":len(chunks),
                "text":chunk,
                **result,
            }
        yield {
            "type":"done",
            "count":len(chunks),
            "voiceProfileId":voice_profile_id,
        }

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
        rows=[]
        text=[]
        for seg in segments:
            value=seg.text.strip()
            if value:
                text.append(value)
            rows.append({
                "startMs":round(seg.start*1000),
                "endMs":round(seg.end*1000),
                "text":value,
            })
        return {
            "language":getattr(info,"language",language or "und"),
            "text":" ".join(text),
            "segments":rows,
        }

class AuthenticatedHttpTtsEngine:
    """Adapter for an admitted native TTS provider service.

    The provider service owns model loading. Jhadina owns identity, routing,
    authorization and the canonical voice profile.
    """
    def __init__(self, engine_id: str, endpoint: str, token: str, languages: list[str] | None = None):
        self.id = engine_id
        self.endpoint = endpoint.rstrip("/")
        self.token = token
        self.languages = set(languages or [])

    def supports(self, language: str) -> bool:
        return bool(self.endpoint and self.token) and (
            not self.languages or language in self.languages or language.split("-")[0] in self.languages
        )

    def synthesize(
        self,
        text: str,
        language: str,
        voice_profile_id: str,
        delivery: dict | None = None,
    ) -> bytes:
        if voice_profile_id != "jhadina:canonical":
            raise ValueError("VOICE_IDENTITY_NOT_ADMITTED")
        if not self.supports(language):
            raise RuntimeError(f"{self.id}:LANGUAGE_NOT_SUPPORTED")
        body = json.dumps({
            "text": text,
            "language": language,
            "voiceProfileId": voice_profile_id,
            **({"delivery":delivery} if delivery else {}),
        }).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {self.token}",
            },
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("voiceProfileId") != voice_profile_id:
            raise RuntimeError(f"{self.id}:VOICE_PROFILE_MISMATCH")
        if payload.get("mimeType") != "audio/wav":
            raise RuntimeError(f"{self.id}:UNSUPPORTED_AUDIO_FORMAT")
        encoded = payload.get("audioBase64")
        if not isinstance(encoded, str) or not encoded:
            raise RuntimeError(f"{self.id}:EMPTY_AUDIO")
        return base64.b64decode(encoded, validate=True)
