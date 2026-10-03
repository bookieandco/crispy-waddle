"""Authenticated HTTP boundary for a single native Jhadina TTS provider lane."""
from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from worker import (
    CANONICAL_IDENTITY_ID,
    CANONICAL_PROFILE_ID,
    ORIGINAL_JHADINA_DESIGN_BRIEF,
    ProviderConfig,
    create_engine,
    design_response,
    synthesize_response,
)

app = FastAPI(title="Jhadina Native TTS Provider", version="1.0")
_engine: Any = None

class DeliveryRequest(BaseModel):
    rate: float | None = Field(default=None, ge=0.5, le=2.0)
    pauseScale: float | None = Field(default=None, ge=0.5, le=2.0)
    emphasis: list[str] | None = None
    emphasisStrength: float | None = Field(default=None, ge=0, le=1)
    style: str | None = Field(default=None, max_length=64)
    microPauseDensity: float | None = Field(default=None, ge=0, le=1)
    thoughtPauseDurationMs: int | None = Field(default=None, ge=0, le=3000)
    pitchRange: float | None = Field(default=None, ge=0, le=1)
    pitchContour: str | None = Field(default=None, max_length=16)
    energy: float | None = Field(default=None, ge=0, le=1)
    warmth: float | None = Field(default=None, ge=0, le=1)
    groundedConfidence: float | None = Field(default=None, ge=0, le=1)
    conversationality: float | None = Field(default=None, ge=0, le=1)
    intimacy: float | None = Field(default=None, ge=0, le=1)
    breathiness: float | None = Field(default=None, ge=0, le=1)
    sentenceFinality: float | None = Field(default=None, ge=0, le=1)
    spontaneity: float | None = Field(default=None, ge=0, le=1)
    reactionIntensity: float | None = Field(default=None, ge=0, le=1)
    playfulness: float | None = Field(default=None, ge=0, le=1)
    operationalSass: float | None = Field(default=None, ge=0, le=1)
    absurdEscalation: float | None = Field(default=None, ge=0, le=1)
    poeticCompression: float | None = Field(default=None, ge=0, le=1)
    storytellingIntensity: float | None = Field(default=None, ge=0, le=1)

class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    language: str = Field(default="English", min_length=2, max_length=35)
    voiceProfileId: str = CANONICAL_PROFILE_ID
    voiceIdentityId: str = CANONICAL_IDENTITY_ID
    modelId: str = Field(min_length=1, max_length=256)
    providerVoiceRef: str = Field(min_length=1, max_length=256)
    delivery: DeliveryRequest | None = None

class DesignRequest(SpeakRequest):
    instruction: str = Field(default=ORIGINAL_JHADINA_DESIGN_BRIEF, min_length=1, max_length=2000)
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)

def _authorize(authorization: str | None) -> None:
    expected = (os.getenv("JHADINA_TTS_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="JHADINA_TTS_TOKEN_NOT_CONFIGURED")
    supplied = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

def engine():
    global _engine
    if _engine is None:
        _engine = create_engine()
    return _engine

@app.get("/health")
def health():
    try:
        config = ProviderConfig.from_env()
        provider = engine()
        provider.ensure_loaded()
        return {
            "status": "ready",
            "productionReady": config.mode == "clone",
            "auditionReady": config.mode == "design",
            "provider": provider.provider_id,
            "mode": config.mode,
            "modelId": provider.model_id,
            "providerVoiceRef": provider.provider_voice_ref,
            "voiceProfileId": CANONICAL_PROFILE_ID,
            "voiceIdentityId": CANONICAL_IDENTITY_ID,
            "identityAuthority": "REFERENCE_ONLY",
        }
    except Exception as exc:
        try:
            config = ProviderConfig.from_env()
            provider_id = config.provider_id
            mode = config.mode
            model_id = config.model_id
            voice_ref = config.provider_voice_ref
        except Exception:
            provider_id = os.getenv("JHADINA_TTS_PROVIDER", "")
            mode = os.getenv("JHADINA_TTS_MODE", "")
            model_id = os.getenv("JHADINA_TTS_MODEL_ID", "")
            voice_ref = os.getenv("JHADINA_TTS_VOICE_REF", "")
        return {
            "status": "degraded",
            "productionReady": False,
            "auditionReady": False,
            "provider": provider_id,
            "mode": mode,
            "modelId": model_id,
            "providerVoiceRef": voice_ref,
            "voiceProfileId": CANONICAL_PROFILE_ID,
            "voiceIdentityId": CANONICAL_IDENTITY_ID,
            "error": str(exc)[:240],
        }

@app.post("/v1/speak")
def speak(body: SpeakRequest, authorization: str | None = Header(default=None)):
    _authorize(authorization)
    try:
        return synthesize_response(
            engine(),
            text=body.text.strip(),
            language=body.language,
            voice_profile_id=body.voiceProfileId,
            voice_identity_id=body.voiceIdentityId,
            model_id=body.modelId,
            provider_voice_ref=body.providerVoiceRef,
            delivery=body.delivery.model_dump(exclude_none=True) if body.delivery else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)[:240]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:240]) from exc

@app.post("/v1/design")
def design(body: DesignRequest, authorization: str | None = Header(default=None)):
    _authorize(authorization)
    try:
        return design_response(
            engine(),
            text=body.text.strip(),
            language=body.language,
            voice_profile_id=body.voiceProfileId,
            voice_identity_id=body.voiceIdentityId,
            model_id=body.modelId,
            provider_voice_ref=body.providerVoiceRef,
            instruction=body.instruction,
            delivery=body.delivery.model_dump(exclude_none=True) if body.delivery else None,
            seed=body.seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)[:240]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:240]) from exc
