from __future__ import annotations

import hmac
import os
import subprocess
from typing import Any
from fastapi import FastAPI, Header, HTTPException

from worker import DirectorPostRuntime

app = FastAPI(title="Jhadina Director Post Worker", version="1.0")
runtime = DirectorPostRuntime()


def authorize(authorization: str | None) -> None:
    expected = os.getenv("DIRECTOR_POST_WORKER_TOKEN", "").strip()
    supplied = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    if not expected or not supplied or not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")


@app.get("/health")
def health() -> dict[str, Any]:
    return runtime.health()


@app.post("/v1/execute")
def execute(body: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    authorize(authorization)
    capability = body.get("capability")
    payload = body.get("payload")
    if not isinstance(capability, str) or not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="DIRECTOR_POST_EXECUTE_REQUEST_INVALID")
    try:
        return runtime.execute(capability, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except subprocess.SubprocessError as exc:  # type: ignore[name-defined]
        raise HTTPException(status_code=503, detail="DIRECTOR_POST_SUBPROCESS_FAILED") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
