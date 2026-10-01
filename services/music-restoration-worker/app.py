"""HTTP boundary for the private Jhadina Music restoration worker."""
from __future__ import annotations

import hmac
import os
from pathlib import Path
import tempfile
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from source_fetch import stage_verified_source
from vercel_oidc import authorize_vercel_token
from worker import (
    RestorationWorkerConfig,
    analyze_source_recovery_path,
    artifact_path,
    assess_instrument_replacement_path,
    execute_reconstruction_path,
    execute_repair_path,
    execute_vocal_restoration_path,
    perceive_path,
    probe_path,
    runtime_readiness,
    separate_path,
)

app=FastAPI(title="Jhadina Music Restoration Worker",version="1.0")
_config=RestorationWorkerConfig.from_env()

class SourceRef(BaseModel):
    artifactId:str=Field(min_length=1,max_length=240)
    uri:str=Field(min_length=8,max_length=4096)
    sha256:str=Field(min_length=64,max_length=64)
    mimeType:str=Field(min_length=5,max_length=100)

    @field_validator("mimeType")
    @classmethod
    def audio_only(cls,value:str)->str:
        if not value.lower().startswith("audio/"):
            raise ValueError("audio MIME type required")
        return value

class ProbeRequest(BaseModel):
    source:SourceRef

class SeparateRequest(BaseModel):
    jobId:str=Field(min_length=1,max_length=240)
    source:SourceRef
    modelId:str|None=Field(default=None,max_length=120)

class PerceiveRequest(BaseModel):
    source:SourceRef
    role:str|None=Field(default=None,max_length=32)

class SourceRecoveryAnalysisRequest(BaseModel):
    source:SourceRef

class ExecuteRequest(BaseModel):
    executionId:str=Field(min_length=1,max_length=240)
    authorizationId:str=Field(min_length=1,max_length=500)
    source:SourceRef
    operation:str=Field(min_length=1,max_length=40)
    parameters:dict[str,str|int|float|bool]=Field(default_factory=dict)
    sampleRate:int=Field(gt=0,le=384000)
    channels:int=Field(gt=0,le=32)

class ReconstructionSegment(BaseModel):
    targetStartMs:float=Field(ge=0)
    targetEndMs:float=Field(gt=0)
    replacementStartMs:float=Field(ge=0)
    replacementEndMs:float=Field(gt=0)
    gainDb:float=Field(ge=-12,le=12)
    sourceResidualMix:float=Field(ge=0,le=0.25)
    fadeMs:float=Field(ge=0,le=250)
    phaseInvert:bool=False

class InstrumentAssessmentSegment(BaseModel):
    sourceStartMs:float=Field(ge=0)
    sourceEndMs:float=Field(gt=0)
    replacementStartMs:float=Field(ge=0)
    replacementEndMs:float=Field(gt=0)

class InstrumentAssessmentRequest(BaseModel):
    assessmentId:str=Field(min_length=1,max_length=240)
    source:SourceRef
    replacement:SourceRef
    instrumentFamily:str=Field(min_length=1,max_length=64)
    segments:list[InstrumentAssessmentSegment]=Field(min_length=1,max_length=64)

class ReconstructRequest(BaseModel):
    jobId:str=Field(min_length=1,max_length=240)
    requestId:str=Field(min_length=1,max_length=240)
    authorizationId:str=Field(min_length=1,max_length=500)
    source:SourceRef
    replacement:SourceRef
    segments:list[ReconstructionSegment]=Field(min_length=1,max_length=64)
    sampleRate:int=Field(gt=0,le=384000)
    channels:int=Field(gt=0,le=32)

class VocalRepairSegment(BaseModel):
    startMs:float=Field(ge=0)
    endMs:float=Field(gt=0)
    operation:str=Field(min_length=1,max_length=32)
    parameters:dict[str,str|int|float|bool]=Field(default_factory=dict)
    sourceResidualMix:float=Field(ge=0,le=0.25)
    fadeMs:float=Field(ge=0,le=100)

class VocalRestoreRequest(BaseModel):
    jobId:str=Field(min_length=1,max_length=240)
    requestId:str=Field(min_length=1,max_length=240)
    authorizationId:str=Field(min_length=1,max_length=500)
    source:SourceRef
    segments:list[VocalRepairSegment]=Field(min_length=1,max_length=64)
    sampleRate:int=Field(gt=0,le=384000)
    channels:int=Field(gt=0,le=32)

def _authorize(authorization:str|None)->None:
    supplied=authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    if not supplied:
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")
    expected=os.getenv("MUSIC_RESTORATION_WORKER_TOKEN","").strip()
    if expected and hmac.compare_digest(supplied,expected):
        return
    if authorize_vercel_token(supplied):
        return
    raise HTTPException(status_code=401,detail="UNAUTHORIZED")

def _host_suffixes()->tuple[str,...]:
    raw=os.getenv("MUSIC_RESTORATION_SOURCE_HOST_SUFFIXES",".supabase.co")
    values=tuple(value.strip().lower() for value in raw.split(",") if value.strip())
    if not values:
        raise RuntimeError("MUSIC_RESTORATION_SOURCE_HOST_SUFFIXES_REQUIRED")
    return values

def _stage(source:SourceRef,directory:Path)->Path:
    target=directory/"source.bin"
    stage_verified_source(source.uri,source.sha256,target,_host_suffixes())
    return target

def _error(exc:Exception)->HTTPException:
    message=str(exc)[:700]
    if isinstance(exc,ValueError):
        return HTTPException(status_code=422,detail=message)
    return HTTPException(status_code=503,detail=message)

@app.get("/health/live")
def live()->dict[str,str]:
    return {"status":"live","service":"music-restoration-worker"}

@app.get("/health")
def health(authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    readiness=runtime_readiness(_config)
    return {"status":"ready" if readiness["productionReady"] else "blocked",**readiness}

@app.post("/v1/probe")
def probe(body:ProbeRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-probe-") as temp:
            source=_stage(body.source,Path(temp))
            return probe_path(source,body.source.artifactId,body.source.sha256)
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/separate")
def separate(body:SeparateRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-separate-input-") as temp:
            source=_stage(body.source,Path(temp))
            return separate_path(
                source,
                body.source.artifactId,
                body.source.sha256,
                body.jobId,
                _config,
                body.modelId,
            )
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/perceive")
def perceive(body:PerceiveRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-perceive-") as temp:
            source=_stage(body.source,Path(temp))
            return perceive_path(source,body.source.artifactId,body.source.sha256,body.role)
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/analyze/source-recovery")
def analyze_source_recovery(body:SourceRecoveryAnalysisRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-source-recovery-") as temp:
            source=_stage(body.source,Path(temp))
            return analyze_source_recovery_path(source,body.source.artifactId,body.source.sha256)
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/execute")
def execute(body:ExecuteRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-repair-input-") as temp:
            source=_stage(body.source,Path(temp))
            return execute_repair_path(
                source,
                body.source.artifactId,
                body.source.sha256,
                body.executionId,
                body.authorizationId,
                body.operation,
                dict(body.parameters),
                body.sampleRate,
                body.channels,
                _config,
            )
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/reconstruction/assess")
def assess_instrument_replacement(
    body:InstrumentAssessmentRequest,
    authorization:str|None=Header(default=None),
)->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-assess-source-") as source_temp, \
             tempfile.TemporaryDirectory(prefix="music-assess-donor-") as donor_temp:
            source=_stage(body.source,Path(source_temp))
            replacement=_stage(body.replacement,Path(donor_temp))
            return assess_instrument_replacement_path(
                source,replacement,
                body.source.artifactId,body.source.sha256,
                body.replacement.artifactId,body.replacement.sha256,
                body.assessmentId,body.instrumentFamily,
                [segment.model_dump() for segment in body.segments],
            )
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/reconstruct")
def reconstruct(body:ReconstructRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-reconstruct-source-") as source_temp, \
             tempfile.TemporaryDirectory(prefix="music-reconstruct-donor-") as donor_temp:
            source=_stage(body.source,Path(source_temp))
            replacement=_stage(body.replacement,Path(donor_temp))
            return execute_reconstruction_path(
                source,replacement,
                body.source.artifactId,body.source.sha256,
                body.replacement.artifactId,body.replacement.sha256,
                body.jobId,body.requestId,body.authorizationId,
                [segment.model_dump() for segment in body.segments],
                body.sampleRate,body.channels,_config,
            )
    except Exception as exc:
        raise _error(exc) from exc

@app.post("/v1/vocal/restore")
def restore_vocal(body:VocalRestoreRequest,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    try:
        with tempfile.TemporaryDirectory(prefix="music-vocal-source-") as source_temp:
            source=_stage(body.source,Path(source_temp))
            return execute_vocal_restoration_path(
                source,
                body.source.artifactId,
                body.source.sha256,
                body.jobId,
                body.requestId,
                body.authorizationId,
                [segment.model_dump() for segment in body.segments],
                body.sampleRate,
                body.channels,
                _config,
            )
    except Exception as exc:
        raise _error(exc) from exc

@app.get("/v1/jobs/{job_token}/artifact/{name}")
def artifact(job_token:str,name:str,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    path=artifact_path(_config,job_token,name)
    if path is None:
        raise HTTPException(status_code=404,detail="MUSIC_RESTORATION_ARTIFACT_NOT_FOUND")
    return FileResponse(path=path,media_type="audio/wav",filename=name)
