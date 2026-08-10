from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path

ARTIFACT_ROOT = Path(os.getenv("PHYSICS_ARTIFACT_ROOT", "/artifacts"))
BLENDER = os.getenv("BLENDER_BIN", "blender")


def run_simulation(request: dict) -> dict:
    job_id = f"physics-{uuid.uuid4().hex[:12]}"
    job_dir = ARTIFACT_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    request_path = job_dir / "request.json"
    request_path.write_text(json.dumps(request, sort_keys=True))

    script = Path(__file__).with_name("simulate.py")
    output = job_dir / "simulation.blend"
    completed = subprocess.run(
        [BLENDER, "-b", "--python", str(script), "--", str(request_path), str(output)],
        capture_output=True,
        text=True,
        timeout=int(request.get("timeoutSeconds", 1800)),
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr[-4000:] or "Blender simulation failed")

    metrics_path = job_dir / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
    return {
        "artifactId": job_id,
        "artifactPath": str(output),
        "metrics": metrics,
        "provider": "blender",
        "status": "complete",
    }
