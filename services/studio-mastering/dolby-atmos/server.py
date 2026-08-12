from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
from uuid import uuid4
import hashlib
import json
import subprocess

app = FastAPI(title="Jhadina Dolby Atmos Mastering")
ROOT = Path("/var/lib/jhadina/mastering")
ROOT.mkdir(parents=True, exist_ok=True)
PRESETS = Path("/opt/dolby/presets")

class MasterRequest(BaseModel):
    input_artifact: str
    preset: str
    output_name: str

JOBS = {}

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def load_preset(name: str) -> dict:
    path = PRESETS / f"{name}.json"
    if not path.exists():
        raise HTTPException(400, "Unknown mastering preset")
    return json.loads(path.read_text())

@app.get("/health")
def health():
    return {"status": "ready", "provider": "dolby-atmos-conversion-tool"}

@app.post("/v1/jobs")
def create_job(req: MasterRequest):
    preset = load_preset(req.preset)
    job_id = str(uuid4())
    job_dir = ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    JOBS[job_id] = {"jobId": job_id, "status": "queued", "preset": preset, "input": req.input_artifact, "output": req.output_name}
    return JOBS[job_id]

@app.get("/v1/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Job not found")
    return JOBS[job_id]

@app.post("/v1/jobs/{job_id}/run")
def run_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Job not found")
    job = JOBS[job_id]
    # The exact CLI flags are intentionally isolated here so the licensed tool's
    # invocation can be configured against its installed version without leaking
    # command-line details into the Studio application.
    job["status"] = "requires-runtime-configuration"
    job["warnings"] = ["Configure the installed Dolby Conversion Tool CLI invocation for the licensed build before enabling production execution."]
    return job

@app.post("/v1/jobs/{job_id}/qc")
def qc_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Job not found")
    job = JOBS[job_id]
    if job.get("status") != "complete":
        job["qcStatus"] = "blocked"
        job["qcWarnings"] = ["QC cannot promote a job that has not completed conversion."]
        return job
    return {"jobId": job_id, "qcStatus": "review", "warnings": ["Run Dolby/metadata validation against the generated artifact before promotion."]}
