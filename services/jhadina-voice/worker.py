"""Jhadina native voice service — provider-neutral ASR/TTS boundary.

Personality, memory, authorization and subsystem execution remain outside this service.
"""
from __future__ import annotations
import base64, json, math, os, re, subprocess, tempfile, urllib.request
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Iterator, Protocol

CANONICAL_VOICE_PROFILE_ID="jhadina:canonical"
CANONICAL_VOICE_IDENTITY_ID="voice:jhadina:canonical:v1"
DEFAULT_SPEAKER_QC_MODEL_ID="speechbrain/spkrec-ecapa-voxceleb"
DEFAULT_SPEAKER_QC_MODEL_REVISION="ff989f88e92ccc120569763824f8eedd5afc9039"

class AsrEngine(Protocol):
    id: str
    def transcribe(self, wav_path: str, language: str | None = None) -> dict: ...

@dataclass(frozen=True)
class TtsSynthesisArtifact:
    audio_bytes: bytes
    mime_type: str = "audio/wav"
    model_id: str | None = None
    provider_voice_ref: str | None = None
    provider_task_id: str | None = None

class TtsEngine(Protocol):
    id: str
    def supports(self, language: str) -> bool: ...
    def synthesize(
        self,
        text: str,
        language: str,
        voice_profile_id: str,
        delivery: dict | None = None,
        voice_identity_id: str = CANONICAL_VOICE_IDENTITY_ID,
    ) -> TtsSynthesisArtifact | bytes: ...

class SpeakerQcVerifier(Protocol):
    def health(self) -> dict: ...
    def verify(
        self,
        reference_audio: bytes,
        reference_mime_type: str,
        candidate_audio: bytes,
        candidate_mime_type: str,
    ) -> dict: ...

@dataclass(frozen=True)
class VoiceIdentityRuntimePolicy:
    identity_id: str = CANONICAL_VOICE_IDENTITY_ID
    status: str = "candidate"
    approval_receipt_id: str = ""
    reference_audio_path: str = ""
    reference_mime_type: str = "audio/wav"
    reference_sha256: str = ""
    minimum_speaker_similarity: float = 0.80
    expected_qc_model_id: str = DEFAULT_SPEAKER_QC_MODEL_ID
    expected_qc_model_revision: str = DEFAULT_SPEAKER_QC_MODEL_REVISION

    @classmethod
    def from_env(cls) -> "VoiceIdentityRuntimePolicy":
        raw_floor=os.getenv("JHADINA_VOICE_MIN_SPEAKER_SIMILARITY","0.80").strip() or "0.80"
        try:
            floor=float(raw_floor)
        except ValueError:
            floor=float("nan")
        return cls(
            identity_id=os.getenv("JHADINA_VOICE_IDENTITY_ID",CANONICAL_VOICE_IDENTITY_ID).strip() or CANONICAL_VOICE_IDENTITY_ID,
            status=os.getenv("JHADINA_VOICE_IDENTITY_STATUS","candidate").strip().lower() or "candidate",
            approval_receipt_id=os.getenv("JHADINA_VOICE_APPROVAL_RECEIPT_ID","").strip(),
            reference_audio_path=os.getenv("JHADINA_VOICE_REFERENCE_PATH","").strip(),
            reference_mime_type=os.getenv("JHADINA_VOICE_REFERENCE_MIME","audio/wav").strip() or "audio/wav",
            reference_sha256=os.getenv("JHADINA_VOICE_REFERENCE_SHA256","").strip().lower(),
            minimum_speaker_similarity=floor,
            expected_qc_model_id=os.getenv("JHADINA_SPEAKER_QC_MODEL_ID",DEFAULT_SPEAKER_QC_MODEL_ID).strip() or DEFAULT_SPEAKER_QC_MODEL_ID,
            expected_qc_model_revision=os.getenv("JHADINA_SPEAKER_QC_MODEL_REVISION",DEFAULT_SPEAKER_QC_MODEL_REVISION).strip() or DEFAULT_SPEAKER_QC_MODEL_REVISION,
        )

    def readiness_reasons(self) -> list[str]:
        reasons=[]
        if self.identity_id != CANONICAL_VOICE_IDENTITY_ID:
            reasons.append("JHADINA_VOICE_IDENTITY_ID_MISMATCH")
        if self.status != "approved":
            reasons.append("JHADINA_VOICE_IDENTITY_NOT_APPROVED")
        if not self.approval_receipt_id:
            reasons.append("JHADINA_VOICE_APPROVAL_RECEIPT_REQUIRED")
        if not self.reference_audio_path:
            reasons.append("JHADINA_VOICE_REFERENCE_PATH_REQUIRED")
        if not re.fullmatch(r"[a-f0-9]{64}",self.reference_sha256):
            reasons.append("JHADINA_VOICE_REFERENCE_SHA256_REQUIRED")
        if not math.isfinite(self.minimum_speaker_similarity) or self.minimum_speaker_similarity<=0 or self.minimum_speaker_similarity>1:
            reasons.append("JHADINA_VOICE_SIMILARITY_FLOOR_INVALID")
        if self.reference_audio_path:
            path=Path(self.reference_audio_path)
            if not path.is_file():
                reasons.append("JHADINA_VOICE_REFERENCE_FILE_MISSING")
            else:
                data=path.read_bytes()
                if not data:
                    reasons.append("JHADINA_VOICE_REFERENCE_FILE_EMPTY")
                elif re.fullmatch(r"[a-f0-9]{64}",self.reference_sha256) and sha256(data).hexdigest()!=self.reference_sha256:
                    reasons.append("JHADINA_VOICE_REFERENCE_HASH_MISMATCH")
        return reasons

    def reference_bytes(self) -> bytes:
        reasons=self.readiness_reasons()
        if reasons:
            raise RuntimeError("JHADINA_VOICE_IDENTITY_RUNTIME_BLOCKED:"+"|".join(reasons))
        data=Path(self.reference_audio_path).read_bytes()
        if sha256(data).hexdigest()!=self.reference_sha256:
            raise RuntimeError("JHADINA_VOICE_REFERENCE_HASH_MISMATCH")
        return data

class AuthenticatedHttpSpeakerQcVerifier:
    def __init__(self, endpoint: str, token: str | None = None):
        self.endpoint=endpoint.rstrip("/")
        self.token=(token or "").strip()

    def _headers(self, content_type: bool = False) -> dict:
        headers={}
        if self.token:
            headers["authorization"]=f"Bearer {self.token}"
        if content_type:
            headers["content-type"]="application/json"
        return headers

    def health(self) -> dict:
        request=urllib.request.Request(
            self.endpoint+"/health",
            method="GET",
            headers=self._headers(),
        )
        with urllib.request.urlopen(request,timeout=90) as response:
            payload=json.loads(response.read().decode("utf-8"))
        if payload.get("status")!="ready" or payload.get("productionReady") is not True:
            raise RuntimeError("JHADINA_SPEAKER_QC_NOT_READY")
        return payload

    def verify(
        self,
        reference_audio: bytes,
        reference_mime_type: str,
        candidate_audio: bytes,
        candidate_mime_type: str,
    ) -> dict:
        body=json.dumps({
            "referenceMimeType":reference_mime_type,
            "referenceAudioBase64":base64.b64encode(reference_audio).decode(),
            "candidateMimeType":candidate_mime_type,
            "candidateAudioBase64":base64.b64encode(candidate_audio).decode(),
        }).encode("utf-8")
        request=urllib.request.Request(
            self.endpoint+"/v1/verify",
            data=body,
            method="POST",
            headers=self._headers(content_type=True),
        )
        with urllib.request.urlopen(request,timeout=90) as response:
            payload=json.loads(response.read().decode("utf-8"))
        similarity=payload.get("similarity")
        if not isinstance(similarity,(int,float)) or not math.isfinite(float(similarity)):
            raise RuntimeError("JHADINA_SPEAKER_QC_VERIFY_RECEIPT_INVALID")
        if payload.get("qualityClaim") is not False:
            raise RuntimeError("JHADINA_SPEAKER_QC_QUALITY_CLAIM_INVALID")
        for key in ("modelId","modelRevision","referenceSha256","candidateSha256"):
            if not isinstance(payload.get(key),str) or not payload.get(key):
                raise RuntimeError("JHADINA_SPEAKER_QC_VERIFY_RECEIPT_INVALID")
        return payload

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
    identity_policy: VoiceIdentityRuntimePolicy | None = None
    speaker_qc: SpeakerQcVerifier | None = None

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

    @staticmethod
    def _artifact(value:TtsSynthesisArtifact|bytes,engine:TtsEngine)->TtsSynthesisArtifact:
        if isinstance(value,TtsSynthesisArtifact):
            return value
        return TtsSynthesisArtifact(
            audio_bytes=value,
            model_id=getattr(engine,"model_id",engine.id),
            provider_voice_ref=getattr(engine,"provider_voice_ref",None),
        )

    def _assert_production_identity_ready(self)->None:
        if self.identity_policy is None:
            return
        reasons=self.identity_policy.readiness_reasons()
        if reasons:
            raise RuntimeError("JHADINA_VOICE_IDENTITY_RUNTIME_BLOCKED:"+"|".join(reasons))
        if self.speaker_qc is None:
            raise RuntimeError("JHADINA_SPEAKER_QC_REQUIRED")

    def _verify_production_identity(self,artifact:TtsSynthesisArtifact)->dict|None:
        if self.identity_policy is None:
            return None
        reasons=self.identity_policy.readiness_reasons()
        if reasons:
            raise RuntimeError("JHADINA_VOICE_IDENTITY_RUNTIME_BLOCKED:"+"|".join(reasons))
        if self.speaker_qc is None:
            raise RuntimeError("JHADINA_SPEAKER_QC_REQUIRED")
        reference=self.identity_policy.reference_bytes()
        receipt=self.speaker_qc.verify(
            reference,
            self.identity_policy.reference_mime_type,
            artifact.audio_bytes,
            artifact.mime_type,
        )
        expected_reference_sha=self.identity_policy.reference_sha256
        candidate_sha=sha256(artifact.audio_bytes).hexdigest()
        if str(receipt.get("referenceSha256","")).lower()!=expected_reference_sha:
            raise RuntimeError("JHADINA_SPEAKER_QC_REFERENCE_HASH_MISMATCH")
        if str(receipt.get("candidateSha256","")).lower()!=candidate_sha:
            raise RuntimeError("JHADINA_SPEAKER_QC_CANDIDATE_HASH_MISMATCH")
        if receipt.get("modelId")!=self.identity_policy.expected_qc_model_id:
            raise RuntimeError("JHADINA_SPEAKER_QC_MODEL_MISMATCH")
        if receipt.get("modelRevision")!=self.identity_policy.expected_qc_model_revision:
            raise RuntimeError("JHADINA_SPEAKER_QC_MODEL_REVISION_MISMATCH")
        similarity=float(receipt["similarity"])
        if similarity<self.identity_policy.minimum_speaker_similarity:
            raise RuntimeError(f"JHADINA_VOICE_SPEAKER_SIMILARITY_LOW:{similarity:.6f}")
        return {
            "similarity":similarity,
            "modelId":receipt["modelId"],
            "modelRevision":receipt["modelRevision"],
            "referenceSha256":expected_reference_sha,
            "candidateSha256":candidate_sha,
            "minimumSpeakerSimilarity":self.identity_policy.minimum_speaker_similarity,
            "approvalReceiptId":self.identity_policy.approval_receipt_id,
            "qualityClaim":False,
        }

    def _synthesis_result(
        self,
        engine:TtsEngine,
        artifact:TtsSynthesisArtifact,
        voice_profile_id:str,
        voice_identity_id:str,
        verification:dict|None,
        candidate_unapproved:bool=False,
    )->dict:
        output={
            "provider":engine.id,
            "mimeType":artifact.mime_type,
            "audioBase64":base64.b64encode(artifact.audio_bytes).decode(),
            "audioSha256":sha256(artifact.audio_bytes).hexdigest(),
            "voiceProfileId":voice_profile_id,
            "voiceIdentityId":voice_identity_id,
            "modelId":artifact.model_id or getattr(engine,"model_id",engine.id),
            "providerVoiceRef":artifact.provider_voice_ref or getattr(engine,"provider_voice_ref",None),
            "qualityClaim":False,
        }
        if artifact.provider_task_id:
            output["providerTaskId"]=artifact.provider_task_id
        if verification is not None:
            output["identityVerification"]=verification
        if candidate_unapproved:
            output["approvalState"]="candidate_unapproved"
            output["candidateUnapproved"]=True
        return output

    def speak(
        self,
        text: str,
        language: str,
        voice_profile_id: str=CANONICAL_VOICE_PROFILE_ID,
        delivery: dict | None = None,
        voice_identity_id: str=CANONICAL_VOICE_IDENTITY_ID,
    ) -> dict:
        if voice_profile_id != CANONICAL_VOICE_PROFILE_ID or voice_identity_id != CANONICAL_VOICE_IDENTITY_ID:
            raise ValueError("VOICE_IDENTITY_NOT_ADMITTED")
        self._assert_production_identity_ready()
        failures=[]
        for engine in self.tts:
            if not engine.supports(language):
                continue
            try:
                artifact=self._artifact(
                    engine.synthesize(text,language,voice_profile_id,delivery,voice_identity_id),
                    engine,
                )
                verification=self._verify_production_identity(artifact)
                return self._synthesis_result(
                    engine,artifact,voice_profile_id,voice_identity_id,verification,
                )
            except Exception as exc:
                failures.append(f"{engine.id}:{type(exc).__name__}")
        raise RuntimeError("VOICE_TTS_FAILED:"+"|".join(failures))

    def audition(
        self,
        text: str,
        language: str,
        voice_profile_id: str=CANONICAL_VOICE_PROFILE_ID,
        delivery: dict | None = None,
        voice_identity_id: str=CANONICAL_VOICE_IDENTITY_ID,
    ) -> dict:
        if voice_profile_id != CANONICAL_VOICE_PROFILE_ID or voice_identity_id != CANONICAL_VOICE_IDENTITY_ID:
            raise ValueError("VOICE_IDENTITY_NOT_ADMITTED")
        failures=[]
        for engine in self.tts:
            if not engine.supports(language):
                continue
            try:
                artifact=self._artifact(
                    engine.synthesize(text,language,voice_profile_id,delivery,voice_identity_id),
                    engine,
                )
                return self._synthesis_result(
                    engine,artifact,voice_profile_id,voice_identity_id,None,candidate_unapproved=True,
                )
            except Exception as exc:
                failures.append(f"{engine.id}:{type(exc).__name__}")
        raise RuntimeError("VOICE_AUDITION_FAILED:"+"|".join(failures))

    def speak_stream(
        self,
        text: str,
        language: str,
        voice_profile_id: str=CANONICAL_VOICE_PROFILE_ID,
        delivery: dict | None = None,
        voice_identity_id: str=CANONICAL_VOICE_IDENTITY_ID,
        max_chars: int = 240,
    ) -> Iterator[dict]:
        chunks=split_speech_chunks(text,max_chars)
        if not chunks:
            raise ValueError("VOICE_TEXT_EMPTY")
        for index,chunk in enumerate(chunks):
            result=self.speak(chunk,language,voice_profile_id,delivery,voice_identity_id)
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
            "voiceIdentityId":voice_identity_id,
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
    def __init__(
        self,
        engine_id: str,
        endpoint: str,
        token: str,
        languages: list[str] | None = None,
        model_id: str | None = None,
        provider_voice_ref: str | None = None,
    ):
        self.id = engine_id
        self.endpoint = endpoint.rstrip("/")
        self.token = token
        self.languages = set(languages or [])
        self.model_id = (model_id or "").strip()
        self.provider_voice_ref = (provider_voice_ref or "").strip()

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
        voice_identity_id: str = CANONICAL_VOICE_IDENTITY_ID,
    ) -> TtsSynthesisArtifact:
        if voice_profile_id != CANONICAL_VOICE_PROFILE_ID or voice_identity_id != CANONICAL_VOICE_IDENTITY_ID:
            raise ValueError("VOICE_IDENTITY_NOT_ADMITTED")
        if not self.supports(language):
            raise RuntimeError(f"{self.id}:LANGUAGE_NOT_SUPPORTED")
        if not self.model_id or not self.provider_voice_ref:
            raise RuntimeError(f"{self.id}:VOICE_PROVIDER_BINDING_INCOMPLETE")
        body = json.dumps({
            "text": text,
            "language": language,
            "voiceProfileId": voice_profile_id,
            "voiceIdentityId": voice_identity_id,
            "modelId": self.model_id,
            "providerVoiceRef": self.provider_voice_ref,
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
        if payload.get("voiceIdentityId") != voice_identity_id:
            raise RuntimeError(f"{self.id}:VOICE_IDENTITY_MISMATCH")
        if payload.get("modelId") != self.model_id:
            raise RuntimeError(f"{self.id}:MODEL_ID_MISMATCH")
        if payload.get("providerVoiceRef") != self.provider_voice_ref:
            raise RuntimeError(f"{self.id}:PROVIDER_VOICE_REF_MISMATCH")
        if payload.get("mimeType") != "audio/wav":
            raise RuntimeError(f"{self.id}:UNSUPPORTED_AUDIO_FORMAT")
        encoded = payload.get("audioBase64")
        if not isinstance(encoded, str) or not encoded:
            raise RuntimeError(f"{self.id}:EMPTY_AUDIO")
        return TtsSynthesisArtifact(
            audio_bytes=base64.b64decode(encoded, validate=True),
            mime_type="audio/wav",
            model_id=self.model_id,
            provider_voice_ref=self.provider_voice_ref,
            provider_task_id=str(payload.get("providerTaskId","")).strip() or None,
        )
