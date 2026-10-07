"""Allowlist for the localhost Director human-media sidecar proxy."""
from __future__ import annotations
import re

_JOB=re.compile(r"^v1/jobs/[A-Za-z0-9._:-]{1,160}$")
_ARTIFACT=re.compile(r"^v1/jobs/[A-Za-z0-9._:-]{1,160}/artifact$")

def human_media_proxy_path_allowed(path:str,method:str)->bool:
    if not path or "?" in path or ".." in path or "\\" in path:
        return False
    verb=method.upper()
    if path in {"health","health/live"}:
        return verb=="GET"
    if path=="v1/jobs":
        return verb=="POST"
    if _JOB.fullmatch(path):
        return verb in {"GET","DELETE"}
    if _ARTIFACT.fullmatch(path):
        return verb=="GET"
    return False
