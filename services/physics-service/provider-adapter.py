from typing import Protocol
from .provider_runtime import SimulationArtifact

class PhysicsProvider(Protocol):
    name: str

    def health(self) -> dict: ...

    def simulate(self, request: dict) -> SimulationArtifact: ...

    def fetch_artifact(self, artifact_id: str) -> bytes: ...

class ExternalPhysicsProvider:
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url.rstrip("/")

    def health(self) -> dict:
        return {"provider": self.name, "status": "external", "url": self.base_url}

    def simulate(self, request: dict) -> SimulationArtifact:
        # Actual HTTP/GPU invocation is deliberately provider-specific.
        raise NotImplementedError(f"Deploy provider runtime at {self.base_url}")

    def fetch_artifact(self, artifact_id: str) -> bytes:
        raise NotImplementedError("Artifact download must be implemented by the deployed provider")
