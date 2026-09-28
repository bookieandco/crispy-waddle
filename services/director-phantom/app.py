"""Authenticated HTTP host for the Director Phantom-Wan worker."""
from __future__ import annotations

import hmac
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse

from worker import PhantomJobManager, PhantomRuntimeConfig

app=FastAPI(title="Jhadina Director Phantom",version="1.0")
_manager:PhantomJobManager|None=None


def _authorize(authorization:str|None)->None:
    expected=os.getenv("DIRECTOR_PHANTOM_WORKER_TOKEN","")
    if not expected:
        raise HTTPException(status_code=503,detail="DIRECTOR_PHANTOM_WORKER_TOKEN_NOT_CONFIGURED")
    supplied=""
    if authorization and authorization.startswith("Bearer "):
        supplied=authorization[7:]
    if not supplied or not hmac.compare_digest(supplied,expected):
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")


def _runtime_config()->PhantomRuntimeConfig:
    try:
        return PhantomRuntimeConfig.from_env()
    except ValueError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc


def _job_manager()->PhantomJobManager:
    global _manager
    if _manager is None:
        _manager=PhantomJobManager(_runtime_config())
    return _manager


@app.get("/health/live")
def live()->dict[str,object]:
    return {"status":"live","service":"director-phantom"}


@app.get("/health")
def health()->dict[str,object]:
    config=_runtime_config()
    ready=config.production_ready()
    return {
        "status":"ready" if ready else "blocked",
        "productionReady":ready,
        "repo":str(config.repo_dir),
        "wanCheckpointDirPresent":config.wan_ckpt_dir.exists(),
        "phantom13BCheckpointPresent":config.checkpoint_1_3b.exists(),
        "phantom14BCheckpointPresent":config.checkpoint_14b.exists(),
    }


@app.post("/v1/jobs")
def submit(
    body:dict[str,Any],
    authorization:str|None=Header(default=None),
    idempotency_key:str|None=Header(default=None,alias="idempotency-key"),
)->dict[str,Any]:
    _authorize(authorization)
    if not idempotency_key:
        raise HTTPException(status_code=400,detail="DIRECTOR_PHANTOM_IDEMPOTENCY_KEY_REQUIRED")
    request=body.get("request")
    if not isinstance(request,dict):
        raise HTTPException(status_code=400,detail="DIRECTOR_PHANTOM_REQUEST_REQUIRED")
    config=_runtime_config()
    if not config.production_ready():
        raise HTTPException(status_code=503,detail="DIRECTOR_PHANTOM_RUNTIME_NOT_READY")
    try:
        return _job_manager().submit(request,idempotency_key)
    except ValueError as exc:
        raise HTTPException(status_code=400,detail=str(exc)) from exc


@app.get("/v1/jobs/{job_id}")
def status(job_id:str,authorization:str|None=Header(default=None))->dict[str,Any]:
    _authorize(authorization)
    state=_job_manager().status(job_id)
    if not state:
        raise HTTPException(status_code=404,detail="DIRECTOR_PHANTOM_JOB_NOT_FOUND")
    return state


@app.get("/v1/jobs/{job_id}/artifact")
def artifact(job_id:str,authorization:str|None=Header(default=None)):
    _authorize(authorization)
    path=_job_manager().artifact_path(job_id)
    if not path:
        raise HTTPException(status_code=409,detail="DIRECTOR_PHANTOM_ARTIFACT_NOT_READY")
    return FileResponse(path,media_type="video/mp4",filename=f"{job_id}.mp4")


@app.delete("/v1/jobs/{job_id}")
def cancel(job_id:str,authorization:str|None=Header(default=None))->dict[str,object]:
    _authorize(authorization)
    if not _job_manager().cancel(job_id):
        raise HTTPException(status_code=404,detail="DIRECTOR_PHANTOM_JOB_NOT_FOUND")
    return {"ok":True,"providerJobId":job_id,"status":"cancelled"}
