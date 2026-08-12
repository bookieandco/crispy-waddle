from dataclasses import dataclass
from typing import Protocol

@dataclass
class SAM2TrackRequest:
    video_path: str
    frame_start: int
    frame_end: int
    prompts: list[dict]
    checkpoint: str = "sam2.1_hiera_large"

class SAM2Runtime(Protocol):
    def health(self) -> dict: ...
    def track(self, request: SAM2TrackRequest) -> list[dict]: ...

class ExternalSAM2Runtime:
    """Provider boundary for a GPU-deployed SAM 2/SAM 2.1 worker."""
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def health(self) -> dict:
        return {"provider": "sam2", "status": "external", "url": self.base_url}

    def track(self, request: SAM2TrackRequest) -> list[dict]:
        raise NotImplementedError("Deploy the GPU SAM2 worker before executing inference")
