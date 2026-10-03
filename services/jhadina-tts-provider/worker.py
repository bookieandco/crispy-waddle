"""Native Qwen3-TTS / VoxCPM2 provider boundary for Jhadina.

This service renders audio only. Canonical identity admission, approval, ECAPA QC,
routing and final authority remain in services/jhadina-voice.
"""
from __future__ import annotations

import base64
import hashlib
import io
import os
import re
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

CANONICAL_PROFILE_ID = "jhadina:canonical"
CANONICAL_IDENTITY_ID = "voice:jhadina:canonical:v1"

DEFAULT_QWEN_DESIGN_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
DEFAULT_QWEN_CLONE_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
DEFAULT_VOXCPM_MODEL = "openbmb/VoxCPM2"

ORIGINAL_JHADINA_DESIGN_BRIEF = (
    "Original adult feminine assistant voice. Warm and grounded, conversational and clear, "
    "unhurried without sounding sleepy, confident without sounding theatrical, emotionally "
    "present without forced sentimentality, with subtle playful intelligence. Natural pauses, "
    "clean diction, medium-low vocal energy, and enough expressive range to move between "
    "serious precision, dry humor, affectionate banter, and reflective conversation while "
    "remaining recognizably the same speaker. Do not imitate any real person or character."
)

class NativeEngine(Protocol):
    provider_id: str
    model_id: str
    provider_voice_ref: str
    sample_rate: int

    def ensure_loaded(self) -> None: ...
    def synthesize(
        self,
        text: str,
        language: str,
        delivery: dict[str, Any] | None = None,
    ) -> tuple[Any, int]: ...
    def design(
        self,
        text: str,
        language: str,
        instruction: str,
        delivery: dict[str, Any] | None = None,
        seed: int | None = None,
    ) -> tuple[Any, int]: ...

def _nonempty(value: str | None) -> str:
    return (value or "").strip()

def _sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _validate_reference(path: str, expected_sha256: str) -> None:
    if not path:
        raise RuntimeError("JHADINA_TTS_REFERENCE_PATH_REQUIRED")
    if not expected_sha256 or not re.fullmatch(r"[a-f0-9]{64}", expected_sha256.lower()):
        raise RuntimeError("JHADINA_TTS_REFERENCE_SHA256_REQUIRED")
    if not Path(path).is_file():
        raise RuntimeError("JHADINA_TTS_REFERENCE_NOT_FOUND")
    if _sha256_file(path).lower() != expected_sha256.lower():
        raise RuntimeError("JHADINA_TTS_REFERENCE_SHA256_MISMATCH")

def _wav_bytes(wav: Any, sample_rate: int) -> bytes:
    import numpy as np
    import soundfile as sf

    array = np.asarray(wav, dtype=np.float32).squeeze()
    if array.ndim != 1 or array.size == 0:
        raise RuntimeError("JHADINA_TTS_EMPTY_WAVEFORM")
    output = io.BytesIO()
    sf.write(output, array, sample_rate, format="WAV", subtype="PCM_16")
    return output.getvalue()

QWEN_LANGUAGE_NAMES = {
    "en": "English",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German",
    "fr": "French",
    "ru": "Russian",
    "pt": "Portuguese",
    "es": "Spanish",
    "it": "Italian",
}

def _qwen_language(language: str) -> str:
    value = (language or "").strip()
    if not value:
        return "Auto"
    base = value.split("-", 1)[0].lower()
    return QWEN_LANGUAGE_NAMES.get(base, value)

def _delivery_instruction(delivery: dict[str, Any] | None) -> str:
    if not delivery:
        return ""
    parts: list[str] = []
    style = _nonempty(str(delivery.get("style", "")))
    if style and style not in {"default", "serious"}:
        parts.append("delivery style " + style)

    rate = delivery.get("rate")
    if isinstance(rate, (int, float)):
        if rate <= 0.94:
            parts.append("slightly slower pace")
        elif rate >= 1.06:
            parts.append("slightly quicker pace")

    warmth = delivery.get("warmth")
    if isinstance(warmth, (int, float)) and warmth >= 0.7:
        parts.append("warm tone")
    confidence = delivery.get("groundedConfidence")
    if isinstance(confidence, (int, float)) and confidence >= 0.7:
        parts.append("grounded confidence")
    conversationality = delivery.get("conversationality")
    if isinstance(conversationality, (int, float)) and conversationality >= 0.65:
        parts.append("natural conversational phrasing")
    playfulness = delivery.get("playfulness")
    if isinstance(playfulness, (int, float)) and playfulness >= 0.55:
        parts.append("subtle playful energy")
    intimacy = delivery.get("intimacy")
    if isinstance(intimacy, (int, float)) and intimacy >= 0.55:
        parts.append("closer, more intimate delivery")
    energy = delivery.get("energy")
    if isinstance(energy, (int, float)):
        if energy <= 0.35:
            parts.append("restrained energy")
        elif energy >= 0.72:
            parts.append("lively energy")
    if delivery.get("pitchContour") == "level":
        parts.append("steady pitch contour")

    return ", ".join(parts[:6])

@dataclass
class ProviderConfig:
    provider_id: str
    mode: str
    model_id: str
    provider_voice_ref: str
    reference_path: str
    reference_sha256: str
    reference_text: str
    design_brief: str
    device: str

    @classmethod
    def from_env(cls) -> "ProviderConfig":
        provider = _nonempty(os.getenv("JHADINA_TTS_PROVIDER")) or "qwen3-tts"
        mode = _nonempty(os.getenv("JHADINA_TTS_MODE")) or "clone"
        if provider not in {"qwen3-tts", "voxcpm2"}:
            raise RuntimeError("JHADINA_TTS_PROVIDER_INVALID")
        if mode not in {"design", "clone"}:
            raise RuntimeError("JHADINA_TTS_MODE_INVALID")
        default_model = (
            DEFAULT_QWEN_DESIGN_MODEL if provider == "qwen3-tts" and mode == "design"
            else DEFAULT_QWEN_CLONE_MODEL if provider == "qwen3-tts"
            else DEFAULT_VOXCPM_MODEL
        )
        voice_ref = _nonempty(os.getenv("JHADINA_TTS_VOICE_REF"))
        if not voice_ref:
            voice_ref = "jhadina-qwen-v1" if provider == "qwen3-tts" else "jhadina-voxcpm2-v1"
        return cls(
            provider_id=provider,
            mode=mode,
            model_id=_nonempty(os.getenv("JHADINA_TTS_MODEL_ID")) or default_model,
            provider_voice_ref=voice_ref,
            reference_path=_nonempty(os.getenv("JHADINA_TTS_REFERENCE_PATH")),
            reference_sha256=_nonempty(os.getenv("JHADINA_TTS_REFERENCE_SHA256")).lower(),
            reference_text=_nonempty(os.getenv("JHADINA_TTS_REFERENCE_TEXT")),
            design_brief=_nonempty(os.getenv("JHADINA_TTS_DESIGN_BRIEF")) or ORIGINAL_JHADINA_DESIGN_BRIEF,
            device=_nonempty(os.getenv("JHADINA_TTS_DEVICE")) or "cuda:0",
        )

class QwenEngine:
    provider_id = "qwen3-tts"
    sample_rate = 24000

    def __init__(self, config: ProviderConfig):
        self.config = config
        self.model_id = config.model_id
        self.provider_voice_ref = config.provider_voice_ref
        self._model: Any = None
        self._clone_prompt: Any = None
        self._lock = threading.Lock()

    def ensure_loaded(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            if self.config.mode == "clone":
                _validate_reference(self.config.reference_path, self.config.reference_sha256)
                if not self.config.reference_text:
                    raise RuntimeError("JHADINA_TTS_REFERENCE_TEXT_REQUIRED")
            import torch
            from qwen_tts import Qwen3TTSModel
            kwargs: dict[str, Any] = {
                "device_map": self.config.device,
                "dtype": torch.bfloat16,
            }
            attn = _nonempty(os.getenv("JHADINA_TTS_ATTN_IMPLEMENTATION"))
            if attn:
                kwargs["attn_implementation"] = attn
            self._model = Qwen3TTSModel.from_pretrained(self.model_id, **kwargs)
            if self.config.mode == "clone":
                self._clone_prompt = self._model.create_voice_clone_prompt(
                    ref_audio=self.config.reference_path,
                    ref_text=self.config.reference_text,
                )

    def synthesize(
        self,
        text: str,
        language: str,
        delivery: dict[str, Any] | None = None,
    ) -> tuple[Any, int]:
        if self.config.mode != "clone":
            raise RuntimeError("JHADINA_TTS_PRODUCTION_REQUIRES_CLONE_MODE")
        self.ensure_loaded()
        wavs, sr = self._model.generate_voice_clone(
            text=text,
            language=_qwen_language(language),
            voice_clone_prompt=self._clone_prompt,
        )
        return wavs[0], int(sr)

    def design(
        self,
        text: str,
        language: str,
        instruction: str,
        delivery: dict[str, Any] | None = None,
        seed: int | None = None,
    ) -> tuple[Any, int]:
        if self.config.mode != "design":
            raise RuntimeError("JHADINA_TTS_DESIGN_MODE_REQUIRED")
        self.ensure_loaded()
        extra = _delivery_instruction(delivery)
        full_instruction = instruction.strip() or self.config.design_brief
        if extra:
            full_instruction += ". " + extra + "."
        if seed is not None:
            import torch
            torch.manual_seed(int(seed))
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(int(seed))
        wavs, sr = self._model.generate_voice_design(
            text=text,
            language=_qwen_language(language),
            instruct=full_instruction,
        )
        return wavs[0], int(sr)

class VoxCpmEngine:
    provider_id = "voxcpm2"
    sample_rate = 48000

    def __init__(self, config: ProviderConfig):
        self.config = config
        self.model_id = config.model_id
        self.provider_voice_ref = config.provider_voice_ref
        self._model: Any = None
        self._lock = threading.Lock()

    def ensure_loaded(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            if self.config.mode == "clone":
                _validate_reference(self.config.reference_path, self.config.reference_sha256)
            from voxcpm import VoxCPM
            self._model = VoxCPM.from_pretrained(
                self.model_id,
                load_denoiser=False,
                device=self.config.device,
            )
            self.sample_rate = int(self._model.tts_model.sample_rate)

    @staticmethod
    def _controlled_text(text: str, instruction: str) -> str:
        clean = re.sub(r"[()（）]", "", instruction).strip()
        return "(" + clean + ")" + text if clean else text

    def synthesize(
        self,
        text: str,
        language: str,
        delivery: dict[str, Any] | None = None,
    ) -> tuple[Any, int]:
        if self.config.mode != "clone":
            raise RuntimeError("JHADINA_TTS_PRODUCTION_REQUIRES_CLONE_MODE")
        self.ensure_loaded()
        control = _delivery_instruction(delivery)
        wav = self._model.generate(
            text=self._controlled_text(text, control),
            reference_wav_path=self.config.reference_path,
            cfg_value=2.0,
            inference_timesteps=10,
            normalize=True,
        )
        return wav, self.sample_rate

    def design(
        self,
        text: str,
        language: str,
        instruction: str,
        delivery: dict[str, Any] | None = None,
        seed: int | None = None,
    ) -> tuple[Any, int]:
        if self.config.mode != "design":
            raise RuntimeError("JHADINA_TTS_DESIGN_MODE_REQUIRED")
        self.ensure_loaded()
        extra = _delivery_instruction(delivery)
        full_instruction = instruction.strip() or self.config.design_brief
        if extra:
            full_instruction += ", " + extra
        wav = self._model.generate(
            text=self._controlled_text(text, full_instruction),
            cfg_value=2.0,
            inference_timesteps=10,
            normalize=True,
            seed=seed,
        )
        return wav, self.sample_rate

def create_engine(config: ProviderConfig | None = None) -> NativeEngine:
    resolved = config or ProviderConfig.from_env()
    if resolved.provider_id == "qwen3-tts":
        return QwenEngine(resolved)
    if resolved.provider_id == "voxcpm2":
        return VoxCpmEngine(resolved)
    raise RuntimeError("JHADINA_TTS_PROVIDER_INVALID")

def synthesize_response(
    engine: NativeEngine,
    *,
    text: str,
    language: str,
    voice_profile_id: str,
    voice_identity_id: str,
    model_id: str,
    provider_voice_ref: str,
    delivery: dict[str, Any] | None,
) -> dict[str, Any]:
    if voice_profile_id != CANONICAL_PROFILE_ID or voice_identity_id != CANONICAL_IDENTITY_ID:
        raise ValueError("JHADINA_TTS_IDENTITY_NOT_ADMITTED")
    if model_id != engine.model_id:
        raise ValueError("JHADINA_TTS_MODEL_ID_MISMATCH")
    if provider_voice_ref != engine.provider_voice_ref:
        raise ValueError("JHADINA_TTS_PROVIDER_VOICE_REF_MISMATCH")
    wav, sr = engine.synthesize(text, language, delivery)
    audio = _wav_bytes(wav, sr)
    return {
        "provider": engine.provider_id,
        "providerTaskId": str(uuid.uuid4()),
        "voiceProfileId": CANONICAL_PROFILE_ID,
        "voiceIdentityId": CANONICAL_IDENTITY_ID,
        "modelId": engine.model_id,
        "providerVoiceRef": engine.provider_voice_ref,
        "mimeType": "audio/wav",
        "audioBase64": base64.b64encode(audio).decode("ascii"),
        "audioSha256": hashlib.sha256(audio).hexdigest(),
        "sampleRateHz": sr,
        "qualityClaim": False,
    }

def design_response(
    engine: NativeEngine,
    *,
    text: str,
    language: str,
    voice_profile_id: str,
    voice_identity_id: str,
    model_id: str,
    provider_voice_ref: str,
    instruction: str,
    delivery: dict[str, Any] | None,
    seed: int | None,
) -> dict[str, Any]:
    if voice_profile_id != CANONICAL_PROFILE_ID or voice_identity_id != CANONICAL_IDENTITY_ID:
        raise ValueError("JHADINA_TTS_IDENTITY_NOT_ADMITTED")
    if model_id != engine.model_id:
        raise ValueError("JHADINA_TTS_MODEL_ID_MISMATCH")
    if provider_voice_ref != engine.provider_voice_ref:
        raise ValueError("JHADINA_TTS_PROVIDER_VOICE_REF_MISMATCH")
    wav, sr = engine.design(text, language, instruction, delivery, seed)
    audio = _wav_bytes(wav, sr)
    return {
        "provider": engine.provider_id,
        "providerTaskId": str(uuid.uuid4()),
        "voiceProfileId": CANONICAL_PROFILE_ID,
        "voiceIdentityId": CANONICAL_IDENTITY_ID,
        "modelId": engine.model_id,
        "providerVoiceRef": engine.provider_voice_ref,
        "mimeType": "audio/wav",
        "audioBase64": base64.b64encode(audio).decode("ascii"),
        "audioSha256": hashlib.sha256(audio).hexdigest(),
        "sampleRateHz": sr,
        "candidateUnapproved": True,
        "approvalState": "candidate_unapproved",
        "qualityClaim": False,
    }
