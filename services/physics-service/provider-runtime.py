from dataclasses import dataclass
from hashlib import sha256

@dataclass
class SimulationArtifact:
    artifact_id: str
    provider: str
    frame_start: int
    frame_end: int
    cache_key: str
    status: str


def cache_key(request: dict) -> str:
    canonical = repr(sorted(request.items())).encode()
    return sha256(canonical).hexdigest()


def choose_provider(request: dict) -> str:
    requested = request.get("provider", "auto")
    if requested != "auto":
        return requested
    assets = request.get("physicsAssetIds", [])
    return "cloth-hair-rigid-default" if assets else "none"


def build_retry_request(request: dict, qc: dict, attempt: int) -> dict | None:
    if attempt >= 2 or qc.get("overall", 0) >= 90:
        return None
    retry = dict(request)
    retry["attempt"] = attempt + 1
    retry["solverTuning"] = {
        "substepsMultiplier": 1.5 if qc.get("penetration_events", 0) else 1.0,
        "collisionMarginMultiplier": 1.5 if qc.get("max_penetration", 0) > 0.01 else 1.0,
        "dampingMultiplier": 1.15 if qc.get("invalid_frames", 0) else 1.0,
    }
    return retry
