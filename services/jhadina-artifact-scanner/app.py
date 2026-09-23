"""Authenticated HTTP boundary for Jhadina's ClamAV-backed artifact scanner."""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from clamd_client import ClamdClient, ClamdError

app = FastAPI(title="Jhadina Artifact Scanner", version="1.0")
MAX_BYTES = int(os.getenv("JHADINA_ARTIFACT_SCAN_MAX_BYTES", str(250 * 1024 * 1024)))


class ScanResponse(BaseModel):
    assetId: str
    sha256: str
    verdict: str
    mimeType: str
    sizeBytes: int
    reasons: list[str]
    scannedAt: str


def _authorize(authorization: str | None) -> None:
    expected = os.getenv("JHADINA_MEDIA_SCANNER_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="MEDIA_SCANNER_TOKEN_NOT_CONFIGURED")
    supplied = ""
    if authorization and authorization.startswith("Bearer "):
        supplied = authorization[7:]
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")


def _client() -> ClamdClient:
    try:
        return ClamdClient.from_env()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:160]) from exc


@app.get("/health")
def health() -> dict[str, object]:
    try:
        _client().ping()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"CLAMD_UNAVAILABLE:{str(exc)[:120]}") from exc
    return {"status": "ready", "engine": "clamav", "protocol": "INSTREAM"}


@app.post("/v1/scan", response_model=ScanResponse)
def scan(
    assetId: str = Form(min_length=1, max_length=128),
    mimeType: str = Form(min_length=1, max_length=255),
    sizeBytes: int = Form(gt=0),
    expectedSha256: str = Form(pattern=r"^[0-9a-f]{64}$"),
    file: UploadFile = File(),
    authorization: str | None = Header(default=None),
) -> ScanResponse:
    _authorize(authorization)
    if sizeBytes > MAX_BYTES:
        raise HTTPException(status_code=413, detail="ARTIFACT_SIZE_NOT_ADMITTED")

    try:
        result = _client().scan_stream(file.file)
    except ClamdError as exc:
        raise HTTPException(status_code=503, detail=str(exc)[:180]) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="CLAMD_SCAN_FAILED") from exc

    if result.size_bytes != sizeBytes:
        raise HTTPException(status_code=409, detail="ARTIFACT_SCAN_SIZE_MISMATCH")
    if not hmac.compare_digest(result.sha256, expectedSha256):
        raise HTTPException(status_code=409, detail="ARTIFACT_SCAN_HASH_MISMATCH")

    verdict = "rejected" if result.infected else "clean"
    reasons = [f"clamav:{result.signature}"] if result.signature else []
    scanned_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return ScanResponse(
        assetId=assetId,
        sha256=result.sha256,
        verdict=verdict,
        mimeType=mimeType,
        sizeBytes=result.size_bytes,
        reasons=reasons,
        scannedAt=scanned_at,
    )
