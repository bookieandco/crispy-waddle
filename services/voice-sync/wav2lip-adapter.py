from dataclasses import dataclass
from typing import Protocol

@dataclass
class LipSyncArtifact:
    artifact_id: str
    provider: str
    character_id: str
    frame_start: int
    frame_end: int
    mouth_motion: list[dict]
    confidence: float
    status: str

class Wav2LipProvider(Protocol):
    name: str
    def health(self) -> dict: ...
    def synthesize(self, request: dict) -> LipSyncArtifact: ...

class ExternalWav2LipProvider:
    def __init__(self, base_url: str):
        self.name = 'wav2lip'
        self.base_url = base_url.rstrip('/')

    def health(self) -> dict:
        return {'provider': self.name, 'status': 'external', 'url': self.base_url}

    def synthesize(self, request: dict) -> LipSyncArtifact:
        raise NotImplementedError(f'Deploy Wav2Lip runtime at {self.base_url}')


def map_lips_to_rig(artifact: LipSyncArtifact, rig_map: dict) -> list[dict]:
    """Convert normalized mouth motion into named face/rig controls."""
    frames = []
    for sample in artifact.mouth_motion:
        controls = {}
        for key, value in sample.get('controls', {}).items():
            if key in rig_map:
                controls[rig_map[key]] = value
        frames.append({'frame': sample['frame'], 'controls': controls})
    return frames
