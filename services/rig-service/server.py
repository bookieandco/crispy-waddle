from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from .qc import RigMetrics, score_rig

app = FastAPI(title="Jhadina Rig Service", version="0.1.0")

class RigRequest(BaseModel):
    meshUrl: HttpUrl
    provider: str = "auto"
    characterId: str

@app.get("/health")
def health():
    return {"status": "ok", "providers": {"rignet": "external", "pinocchio": "external"}}

@app.post("/v1/rig")
def rig(request: RigRequest):
    if request.provider not in {"auto", "rignet", "pinocchio"}:
        raise HTTPException(status_code=400, detail="Unsupported rig provider")
    return {"status": "queued", "jobId": f"rig:{request.characterId}", "provider": request.provider, "artifacts": {"skeletonId": None, "skinWeightsId": None, "rigMetadataId": None}}

@app.post("/v1/qc")
def qc(metrics: RigMetrics):
    return score_rig(metrics)
