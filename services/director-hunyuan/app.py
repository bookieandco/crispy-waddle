"""Authenticated HTTP host for the Director HunyuanVideo-1.5 worker."""
from __future__ import annotations
import hmac
import os
from typing import Any
import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from worker import HunyuanJobManager, HunyuanRuntimeConfig, runtime_readiness
from music_proxy_policy import music_proxy_path_allowed

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


_MUSIC_SIDECAR_URL=os.getenv("MUSIC_RESTORATION_SIDECAR_URL","http://127.0.0.1:8093").rstrip("/")
@app.api_route("/music-restoration/{path:path}",methods=["GET","POST"])
async def music_restoration_proxy(path:str,request:Request):
    if not music_proxy_path_allowed(path,request.method):
        raise HTTPException(status_code=404,detail="MUSIC_RESTORATION_PROXY_PATH_NOT_ADMITTED")
    headers:dict[str,str]={}
    authorization=request.headers.get("authorization")
    content_type=request.headers.get("content-type")
    if authorization:
        headers["authorization"]=authorization
    if content_type:
        headers["content-type"]=content_type
    client=httpx.AsyncClient(timeout=httpx.Timeout(3700.0,connect=10.0),follow_redirects=False)
    try:
        upstream_request=client.build_request(
            request.method,
            f"{_MUSIC_SIDECAR_URL}/{path}",
            params=request.query_params,
            headers=headers,
            content=await request.body(),
        )
        upstream=await client.send(upstream_request,stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(status_code=503,detail="MUSIC_RESTORATION_SIDECAR_UNAVAILABLE") from exc

    response_headers={"cache-control":"no-store"}
    disposition=upstream.headers.get("content-disposition")
    if disposition:
        response_headers["content-disposition"]=disposition
    media_type=upstream.headers.get("content-type","application/octet-stream")

    async def stream():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        stream(),
        status_code=upstream.status_code,
        media_type=media_type,
        headers=response_headers,
    )

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
