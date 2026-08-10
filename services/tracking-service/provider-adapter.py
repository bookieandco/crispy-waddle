from dataclasses import dataclass
from typing import Protocol

@dataclass
class TrackArtifact:
    artifact_id: str
    provider: str
    frame_start: int
    frame_end: int
    tracks: list[dict]
    status: str

class TrackingProvider(Protocol):
    name: str
    def health(self) -> dict: ...
    def track(self, request: dict) -> TrackArtifact: ...

class ExternalTrackingProvider:
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url.rstrip('/')

    def health(self) -> dict:
        return {'provider': self.name, 'status': 'external', 'url': self.base_url}

    def track(self, request: dict) -> TrackArtifact:
        raise NotImplementedError(f'Deploy tracking provider runtime at {self.base_url}')
