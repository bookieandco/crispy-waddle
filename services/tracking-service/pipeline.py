from dataclasses import dataclass
from .provider_adapter import TrackArtifact

@dataclass
class TrackingPipelineResult:
    track_artifact_id: str
    downstream_jobs: list[dict]
    warnings: list[str]


def build_downstream_plan(track: TrackArtifact) -> TrackingPipelineResult:
    if track.status != 'complete':
        return TrackingPipelineResult(track.artifact_id, [], ['Tracking artifact is not complete; downstream execution blocked.'])

    kinds = {t.get('kind') for t in track.tracks}
    jobs = []
    if kinds & {'character', 'body', 'hand'}:
        jobs.append({'stage': 'rig', 'trackArtifactId': track.artifact_id})
    if kinds & {'clothing', 'hair', 'prop', 'environment'}:
        jobs.append({'stage': 'physics', 'trackArtifactId': track.artifact_id})
    jobs.append({'stage': 'continuity', 'trackArtifactId': track.artifact_id})
    jobs.append({'stage': 'qc', 'trackArtifactId': track.artifact_id})
    return TrackingPipelineResult(track.artifact_id, jobs, [])
