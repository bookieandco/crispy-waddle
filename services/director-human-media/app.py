"""Localhost-only HTTP host for Director's MuseTalk human-media worker."""
from __future__ import annotations

from typing import Any
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse

from worker import MuseTalkJobManager, MuseTalkRuntimeConfig, runtime_health

app=FastAPI(title="Jhadina Director Human Media — MuseTalk",version="1.0")
_manager:MuseTalkJobManager|None=None

def _config()->MuseTalkRuntimeConfig:
    try:
        return MuseTalkRuntimeConfig.from_env()
    except ValueError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc

def _manager_instance()->MuseTalkJobManager:
    global _manager
    if _manager is None:
        _manager=MuseTalkJobManager(_config())
    return _manager

@app.get("/health/live")
def live()->dict[str,object]:
    return {"status":"live","service":"director-human-media-musetalk"}

@app.get("/health")
def health()->dict[str,Any]:
    receipt=runtime_health(_config())
    return {"status":"ready" if receipt["productionReady"] else "blocked",**receipt}

@app.post("/v1/jobs")
def submit(
    body:dict[str,Any],
    idempotency_key:str|None=Header(default=None,alias="idempotency-key"),
)->dict[str,Any]:
    if not idempotency_key:
        raise HTTPException(status_code=400,detail="DIRECTOR_MUSETALK_IDEMPOTENCY_KEY_REQUIRED")
    request=body.get("request")
    if not isinstance(request,dict):
        raise HTTPException(status_code=400,detail="DIRECTOR_MUSETALK_REQUEST_REQUIRED")
    try:
        return _manager_instance().submit(request,idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc

@app.get("/v1/jobs/{provider_job_id}")
def status(provider_job_id:str)->dict[str,Any]:
    state=_manager_instance().status(provider_job_id)
    if not state:
        raise HTTPException(status_code=404,detail="DIRECTOR_MUSETALK_JOB_NOT_FOUND")
    return state

@app.get("/v1/jobs/{provider_job_id}/artifact")
def artifact(provider_job_id:str):
    path=_manager_instance().artifact_path(provider_job_id)
    if not path:
        raise HTTPException(status_code=409,detail="DIRECTOR_MUSETALK_ARTIFACT_NOT_READY")
    return FileResponse(path,media_type="video/mp4",filename=f"{provider_job_id}.mp4")

@app.delete("/v1/jobs/{provider_job_id}")
def cancel(provider_job_id:str)->dict[str,object]:
    if not _manager_instance().cancel(provider_job_id):
        raise HTTPException(status_code=404,detail="DIRECTOR_MUSETALK_JOB_NOT_FOUND")
    return {"ok":True,"providerJobId":provider_job_id,"status":"cancelled"}
