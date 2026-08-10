from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from .qc import PhysicsMetrics, score_physics

app = FastAPI(title="Jhadina Physics Service", version="0.1.0")

class SimulationRequest(BaseModel):
    characterId: str
    sceneId: str
    frameStart: int
    frameEnd: int
    rigId: str
    physicsAssetIds: list[str]
    constraints: list[dict] = []
    provider: str = "auto"

@app.get("/health")
def health():
    return {"status": "ok", "provider": "external"}

@app.post("/v1/simulations")
def simulate(request: SimulationRequest):
    if request.frameEnd <= request.frameStart:
        raise HTTPException(status_code=400, detail="frameEnd must be greater than frameStart")
    if not request.rigId:
        raise HTTPException(status_code=400, detail="rigId is required")
    return {"status": "queued", "jobId": f"physics:{request.sceneId}:{request.characterId}", "artifactId": None, "provider": request.provider}

@app.post("/v1/qc")
def qc(metrics: PhysicsMetrics):
    return score_physics(metrics)
