"""Allow-list policy for the Director->Music localhost sidecar proxy."""
from __future__ import annotations
import re

_EXACT={
    "health",
    "health/live",
    "v1/probe",
    "v1/separate",
    "v1/perceive",
    "v1/execute",
    "v1/reconstruct",
}
_ARTIFACT=re.compile(
    r"^v1/jobs/[0-9a-f]{24}/artifact/(vocals|drums|bass|other|output)\.wav$"
)

def music_proxy_path_allowed(path:str,method:str)->bool:
    normalized_method=method.upper()
    if path in {"health","health/live"}:
        return normalized_method=="GET"
    if path in {"v1/probe","v1/separate","v1/perceive","v1/execute","v1/reconstruct"}:
        return normalized_method=="POST"
    return normalized_method=="GET" and _ARTIFACT.fullmatch(path) is not None
