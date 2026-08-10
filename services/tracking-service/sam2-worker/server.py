from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from uuid import uuid4

app = FastAPI(title='Jhadina SAM2 Tracking Worker', version='0.1.0')

class TrackRequest(BaseModel):
    videoUrl: HttpUrl
    frameStart: int = 0
    frameEnd: int
    prompts: list[dict] = []
    targetKinds: list[str] = ['character', 'clothing', 'hair', 'hand', 'prop', 'environment']

@app.get('/health')
def health():
    return {'status': 'ready', 'gpu': 'required', 'model': 'sam2'}

@app.post('/v1/track')
def track(request: TrackRequest):
    if request.frameEnd <= request.frameStart:
        raise HTTPException(status_code=400, detail='frameEnd must be greater than frameStart')
    job_id = str(uuid4())
    return {'status': 'queued', 'jobId': job_id, 'provider': 'sam2', 'modelVersion': 'sam2', 'artifactId': None}

@app.get('/v1/jobs/{job_id}')
def job(job_id: str):
    return {'jobId': job_id, 'status': 'queued', 'artifactId': None}
