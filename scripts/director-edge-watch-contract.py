#!/usr/bin/env python3
"""Static safety/convergence contract for Director Watch edge perception and CVAT review."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WATCH = ROOT / "services/director-watch-worker"
EDGE = ROOT / "services/director-edge-vision-worker"
CVAT_PROVIDER = ROOT / "apps/jhadina-web/src/lib/director-cvat-annotation-provider.ts"
CVAT_SERVICE = ROOT / "apps/jhadina-web/src/lib/director-cvat-annotation-service.ts"
CVAT_MIGRATION = ROOT / "supabase/migrations/20261005024500_director_visual_annotation_provider.sql"

handler = (WATCH / "handler.py").read_text()
homebase = (WATCH / "homebase_handler.py").read_text()
prefilter = (WATCH / "edge_prefilter.py").read_text()
docker = (WATCH / "Dockerfile").read_text()
docker_homebase = (WATCH / "Dockerfile.homebase").read_text()
compose = (WATCH / "docker-compose.homebase.yml").read_text()
edge_server = (EDGE / "server.py").read_text()
edge_readme = (EDGE / "README.md").read_text()
cvat_provider = CVAT_PROVIDER.read_text()
cvat_service = CVAT_SERVICE.read_text()
cvat_migration = CVAT_MIGRATION.read_text()

for label, text in (("cloud", handler), ("homebase", homebase)):
    for value in (
        "from edge_prefilter import select_frames",
        'purpose in {"creative", "sports"}',
        'payload.get("background") is True',
        "select_frames(",
        'completed["edgePrefilter"]',
    ):
        if value not in text:
            raise SystemExit(f"DIRECTOR_EDGE_WATCH_PREFILTER_CONTRACT_MISSING:{label}:{value}")

for label, text in (("cloud-image", docker), ("homebase-image", docker_homebase)):
    for value in ("edge_prefilter.py", "local_qwen.py"):
        if value not in text:
            raise SystemExit(f"DIRECTOR_EDGE_WATCH_IMAGE_MODULE_MISSING:{label}:{value}")

for value in (
    "DIRECTOR_WATCH_EDGE_DETECTOR_URL",
    "DIRECTOR_WATCH_EDGE_DETECTOR_LICENSE",
    "DIRECTOR_WATCH_EDGE_DETECTOR_LICENSE_APPROVED",
    "DIRECTOR_WATCH_EDGE_ULTRALYTICS_LICENSE_APPROVAL_REQUIRED",
    "DIRECTOR_WATCH_EDGE_DETECTOR_HTTP_ALLOWLIST",
):
    if value not in prefilter:
        raise SystemExit(f"DIRECTOR_EDGE_WATCH_LICENSE_OR_NETWORK_GATE_MISSING:{value}")

for value in (
    "DIRECTOR_EDGE_VISION_MODEL_PATH",
    "DIRECTOR_EDGE_VISION_MODEL_ID",
    "DIRECTOR_EDGE_VISION_MODEL_LICENSE",
    "DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED",
    "DIRECTOR_EDGE_VISION_PRODUCTION_READY",
    '"authority": "OBSERVATION_ONLY"',
    '"canEstablishIdentity": False',
    '"canEstablishSportsReality": False',
    '"canWager": False',
):
    if value not in edge_server:
        raise SystemExit(f"DIRECTOR_EDGE_VISION_ADMISSION_CONTRACT_MISSING:{value}")

for forbidden in (
    "from ultralytics",
    "import ultralytics",
    "YOLO(",
    "requests.get(",
    "requests.post(",
    "urllib.request",
):
    if forbidden in edge_server:
        raise SystemExit(f"DIRECTOR_EDGE_VISION_VENDOR_OR_REMOTE_FETCH_FORBIDDEN:{forbidden}")

for value in (
    "director-watch-private:",
    "internal: true",
    "DIRECTOR_WATCH_EDGE_DETECTOR_HTTP_ALLOWLIST: edge-vision",
    "DIRECTOR_EDGE_VISION_MODEL_HOST_PATH",
):
    if value not in compose:
        raise SystemExit(f"DIRECTOR_EDGE_HOMEBASE_COMPOSE_CONTRACT_MISSING:{value}")

if "ports:" in compose.split("edge-vision:", 1)[1].split("watch-homebase:", 1)[0]:
    raise SystemExit("DIRECTOR_EDGE_VISION_PUBLIC_PORT_FORBIDDEN")

for value in (
    "It intentionally does **not** vendor Ultralytics code or model weights.",
    "DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED=true",
):
    if value not in edge_readme:
        raise SystemExit(f"DIRECTOR_EDGE_VISION_LICENSE_DOC_MISSING:{value}")

for value in (
    "authority:'GROUND_TRUTH_CANDIDATE_ONLY'",
    "accepted:false",
):
    if value not in cvat_provider:
        raise SystemExit(f"DIRECTOR_CVAT_CANDIDATE_ONLY_CONTRACT_MISSING:{value}")

for value in (
    "reviewDirectorCvatAnnotationImport",
    "input.decision==='accepted'",
    "accepted:input.decision==='accepted'",
    "canEstablishSportsReality:false",
):
    if value not in cvat_service:
        raise SystemExit(f"DIRECTOR_CVAT_REVIEW_GATE_MISSING:{value}")

for value in (
    "accepted boolean not null default false",
    "review_status text not null default 'pending'",
):
    if value not in cvat_migration:
        raise SystemExit(f"DIRECTOR_CVAT_SCHEMA_REVIEW_GATE_MISSING:{value}")

print("DIRECTOR_EDGE_WATCH_CONTRACT_OK")
