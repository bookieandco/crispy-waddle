from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime,timezone

from fastapi import FastAPI,File,Form,Header,HTTPException,UploadFile
from pydantic import BaseModel

from extractors import ExtractionError,extract

app=FastAPI(title="Jhadina Artifact Extractor",version="1.0")
MAX_BYTES=int(os.getenv("JHADINA_ARTIFACT_EXTRACT_MAX_BYTES",str(250*1024*1024)))


class ExtractionResponse(BaseModel):
    assetId:str
    sourceSha256:str
    mimeType:str
    text:str
    metadata:dict[str,object]
    extractedAt:str


def _authorize(value:str|None)->None:
    expected=os.getenv("JHADINA_ARTIFACT_EXTRACTOR_TOKEN","")
    if not expected:
        raise HTTPException(status_code=503,detail="ARTIFACT_EXTRACTOR_TOKEN_NOT_CONFIGURED")
    supplied=value[7:] if value and value.startswith("Bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied,expected):
        raise HTTPException(status_code=401,detail="UNAUTHORIZED")


@app.get("/health")
def health()->dict[str,object]:
    return {
        "status":"ready",
        "documentExtractors":["pdf","docx","xlsx","csv","json","text"],
        "mediaExtractor":"ffmpeg+faster-whisper",
    }


@app.post("/v1/extract",response_model=ExtractionResponse)
async def extract_artifact(
    assetId:str=Form(min_length=1,max_length=128),
    mimeType:str=Form(min_length=1,max_length=255),
    sizeBytes:int=Form(gt=0),
    expectedSha256:str=Form(pattern=r"^[0-9a-f]{64}$"),
    file:UploadFile=File(),
    authorization:str|None=Header(default=None),
)->ExtractionResponse:
    _authorize(authorization)
    if sizeBytes>MAX_BYTES:
        raise HTTPException(status_code=413,detail="ARTIFACT_SIZE_NOT_ADMITTED")
    payload=await file.read(MAX_BYTES+1)
    if len(payload)>MAX_BYTES:
        raise HTTPException(status_code=413,detail="ARTIFACT_SIZE_NOT_ADMITTED")
    if len(payload)!=sizeBytes:
        raise HTTPException(status_code=409,detail="ARTIFACT_EXTRACTION_SIZE_MISMATCH")
    digest=hashlib.sha256(payload).hexdigest()
    if not hmac.compare_digest(digest,expectedSha256):
        raise HTTPException(status_code=409,detail="ARTIFACT_EXTRACTION_HASH_MISMATCH")
    try:
        result=extract(payload,mimeType)
    except ExtractionError as exc:
        raise HTTPException(status_code=422,detail=str(exc)[:180]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503,detail="ARTIFACT_EXTRACTION_FAILED") from exc
    return ExtractionResponse(
        assetId=assetId,
        sourceSha256=digest,
        mimeType=mimeType,
        text=result.text,
        metadata=result.metadata,
        extractedAt=datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
    )
