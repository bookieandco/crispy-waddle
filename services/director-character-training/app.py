"""Authenticated FastAPI host for Director character-training runtime."""
from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException

from http_backend import HttpBackend
from worker import CertificationBackend, RuntimeStatus, run_dataset, run_lora, run_upscale

app=FastAPI(title="Jhadina Director Character Training",version="1.0")


def _authorize(authorization:str|None)->None:
    expected=os.getenv("DIRECTOR_CHARACTER_TRAINING_TOKEN","")
    if not expected:
        raise HTTPException(status_code=503,detail="DIRECTOR_CHARACTER_TRAINING_TOKEN_NOT_CONFIGURED")
    supplied=""
    if authorization and authorization.startswith("Bearer "):
        supplied=authorization[7:]
    if not supplied or not hmac.compare_digest(supplied,expected):
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")


def _backend():
    if os.getenv("DIRECTOR_CHARACTER_TRAINING_CERTIFICATION_MODE","").lower() in {"1","true","yes"}:
        return CertificationBackend()
    try:
        return HttpBackend.from_env()
    except ValueError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc


def _status()->RuntimeStatus:
    if os.getenv("DIRECTOR_CHARACTER_TRAINING_CERTIFICATION_MODE","").lower() in {"1","true","yes"}:
        b=CertificationBackend()
        return RuntimeStatus("contract-certification",b.name,False)
    b=HttpBackend.from_env()
    return RuntimeStatus("production-proxy",b.name,True)


@app.get("/health/live")
def live()->dict[str,object]:
    return {"status":"live","service":"director-character-training"}


@app.get("/health")
def health()->dict[str,object]:
    try:
        status=_status()
    except ValueError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc
    return {
        "status":"ready" if status.production_ready else "certification-ready",
        "mode":status.mode,
        "backend":status.backend,
        "productionReady":status.production_ready,
    }


@app.post("/v1/character-dataset")
def character_dataset(body:dict[str,Any],authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        return run_dataset(_backend(),body)
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502,detail=str(exc)) from exc


@app.post("/v1/character-lora/train")
def character_lora(body:dict[str,Any],authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        return run_lora(_backend(),body)
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502,detail=str(exc)) from exc


@app.post("/v1/video-upscale")
def video_upscale(body:dict[str,Any],authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        return run_upscale(_backend(),body)
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502,detail=str(exc)) from exc
