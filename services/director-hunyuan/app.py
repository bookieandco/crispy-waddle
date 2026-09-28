"""Authenticated HTTP host for the Director HunyuanVideo-1.5 worker."""
from __future__ import annotations
import hmac
import os
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from worker import HunyuanJobManager, HunyuanRuntimeConfig, runtime_readiness

app=FastAPI(title="Jhadina Director HunyuanVideo-1.5",version="1.0")
_manager:HunyuanJobManager|None=None

def _authorize(authorization:str|None)->None:
    expected=os.getenv("DIRECTOR_HUNYUAN_WORKER_TOKEN","")
    if not expected:
        raise HTTPException(status_code=503,detail="DIRECTOR_HUNYUAN_WORKER_TOKEN_NOT_CONFIGURED")
    supplied=authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied,expected):
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")

def _config()->HunyuanRuntimeConfig:
    try:
        return HunyuanRuntimeConfig.from_env()
    except ValueError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc

def _manager_instance()->HunyuanJobManager:
    global _manager
    if _manager is None:
        _manager=HunyuanJobManager(_config())
    return _manager

@app.get("/health/live")
def live()->dict[str,object]:
    return {"status":"live","service":"director-hunyuan-video-1.5"}

@app.get("/health")
def health()->dict[str,object]:
    readiness=runtime_readiness(_config())
    return {"status":"ready" if readiness["productionReady"] else "blocked",**readiness}

@app.post("/v1/jobs")
def submit(body:dict[str,Any],authorization:str|None=Header(default=None),idempotency_key:str|None=Header(default=None,alias="idempotency-key"))->dict[str,Any]:
    _authorize(authorization)
    if not idempotency_key:
        raise HTTPException(status_code=400,detail="DIRECTOR_HUNYUAN_IDEMPOTENCY_KEY_REQUIRED")
    request=body.get("request")
    if not isinstance(request,dict):
        raise HTTPException(status_code=400,detail="DIRECTOR_HUNYUAN_REQUEST_REQUIRED")
    try:
        return _manager_instance().submit(request,idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc

@app.get("/v1/jobs/{job_id}")
def status(job_id:str,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    state=_manager_instance().status(job_id)
    if not state:
        raise HTTPException(status_code=404,detail="DIRECTOR_HUNYUAN_JOB_NOT_FOUND")
    return state

@app.get("/v1/jobs/{job_id}/artifact")
def artifact(job_id:str,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    path=_manager_instance().artifact_path(job_id)
    if not path:
        raise HTTPException(status_code=409,detail="DIRECTOR_HUNYUAN_ARTIFACT_NOT_READY")
    return FileResponse(path,media_type="video/mp4",filename=f"{job_id}.mp4")

@app.delete("/v1/jobs/{job_id}")
def cancel(job_id:str,authorization:str|None=Header(default=None))->dict[str,object]:
    _authorize(authorization)
    if not _manager_instance().cancel(job_id):
        raise HTTPException(status_code=404,detail="DIRECTOR_HUNYUAN_JOB_NOT_FOUND")
    return {"ok":True,"providerJobId":job_id,"status":"cancelled"}
