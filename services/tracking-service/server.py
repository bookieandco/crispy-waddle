from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from .provider_adapter import TrackArtifact
from .pipeline import build_downstream_plan

app = FastAPI(title='Jhadina Tracking Service', version='0.1.0')

class TrackRequest(BaseModel):
    videoUrl: HttpUrl
    frameStart: int = 0
    frameEnd: int
    targetKinds: list[str] = ['character', 'clothing', 'hair', 'hand', 'prop', 'environment']
    provider: str = 'auto'

@app.get('/health')
def health():
    return {'status': 'ok', 'provider': 'external'}

@app.post('/v1/tracks')
def tracks(request: TrackRequest):
    if request.frameEnd <= request.frameStart:
        raise HTTPException(status_code=400, detail='frameEnd must be greater than frameStart')
    return {'status': 'queued', 'jobId': f'track:{request.frameStart}:{request.frameEnd}', 'provider': request.provider, 'artifactId': None, 'targetKinds': request.targetKinds}

@app.post('/v1/pipeline-plan')
def pipeline_plan(payload: dict):
    required = {'artifact_id', 'provider', 'frame_start', 'frame_end', 'tracks', 'status'}
    if not required.issubset(payload):
        raise HTTPException(status_code=400, detail=f'Missing fields: {sorted(required - set(payload))}')
    result = build_downstream_plan(TrackArtifact(**payload))
    return result.__dict__
