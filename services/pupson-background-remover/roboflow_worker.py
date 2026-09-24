import json
import os
import tempfile
import threading
from http import HTTPStatus

from flask import Flask, request
from inference_sdk import InferenceConfiguration, InferenceHTTPClient

PORT = int(os.environ.get("ROBOFLOW_LOCAL_PORT", "5002"))
MAX_BYTES = 15 * 1024 * 1024

ROBOFLOW_API_URL = os.environ.get("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
ROBOFLOW_MODEL_ID = os.environ.get("ROBOFLOW_DOG_MODEL_ID", "dogs-gxbwe/1")
ROBOFLOW_WORKSPACE = os.environ.get("ROBOFLOW_WORKSPACE", "morrisdorian84-gmail-com")
ROBOFLOW_WORKFLOW_ID = os.environ.get("ROBOFLOW_DOG_WORKFLOW_ID", "general-segmentation-api")
ROBOFLOW_CLASSES = os.environ.get("ROBOFLOW_DOG_CLASSES", "dog")

app = Flask(__name__)

_client = None
_client_lock = threading.Lock()


def _get_client():
    global _client
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured.")

    if _client is None:
        with _client_lock:
            if _client is None:
                _client = InferenceHTTPClient(
                    api_url=ROBOFLOW_API_URL,
                    api_key=api_key,
                ).configure(InferenceConfiguration(api_key_transport="header"))
    return _client


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _collect_prediction_like(value, output):
    if isinstance(value, list):
        for item in value:
            _collect_prediction_like(item, output)
        return
    if not isinstance(value, dict):
        return

    class_name = value.get("class") or value.get("class_name")
    confidence = _safe_float(value.get("confidence"))
    if class_name is not None or confidence is not None:
        entry = {
            "class": str(class_name) if class_name is not None else None,
            "confidence": confidence,
        }
        for key in ("x", "y", "width", "height"):
            parsed = _safe_float(value.get(key))
            if parsed is not None:
                entry[key] = parsed
        points = value.get("points")
        if isinstance(points, list):
            entry["points_count"] = len(points)
        output.append(entry)

    for child in value.values():
        if isinstance(child, (dict, list)):
            _collect_prediction_like(child, output)


def _dedupe(predictions):
    seen = set()
    output = []
    for item in predictions:
        marker = json.dumps(item, sort_keys=True, separators=(",", ":"))
        if marker in seen:
            continue
        seen.add(marker)
        output.append(item)
    return output


def _normalize(model_result, workflow_result):
    detections = []
    segments = []
    _collect_prediction_like(model_result, detections)
    if workflow_result is not None:
        _collect_prediction_like(workflow_result, segments)

    detections = _dedupe(detections)
    segments = _dedupe(segments)

    image = model_result.get("image", {}) if isinstance(model_result, dict) else {}
    image_width = _safe_float(image.get("width")) if isinstance(image, dict) else None
    image_height = _safe_float(image.get("height")) if isinstance(image, dict) else None

    confidences = [
        item["confidence"]
        for item in detections + segments
        if isinstance(item.get("confidence"), (float, int))
    ]

    coverage = []
    if image_width and image_height and image_width > 0 and image_height > 0:
        image_area = image_width * image_height
        for item in detections:
            width = item.get("width")
            height = item.get("height")
            if isinstance(width, (float, int)) and isinstance(height, (float, int)):
                coverage.append(max(0.0, min(1.0, (width * height) / image_area)))

    return {
        "status": "ok",
        "model_id": ROBOFLOW_MODEL_ID,
        "workflow_id": ROBOFLOW_WORKFLOW_ID if workflow_result is not None else None,
        "workspace": ROBOFLOW_WORKSPACE if workflow_result is not None else None,
        "dog_detected": bool(detections or segments),
        "detection_count": len(detections),
        "segmentation_count": len(segments),
        "max_confidence": max(confidences) if confidences else None,
        "largest_subject_fraction": max(coverage) if coverage else None,
        "predictions": detections[:20],
        "segments": segments[:20],
    }


def _run(inference_input, run_workflow=True):
    client = _get_client()
    model_result = client.infer(inference_input, model_id=ROBOFLOW_MODEL_ID)
    workflow_result = None
    if run_workflow:
        workflow_result = client.run_workflow(
            workspace_name=ROBOFLOW_WORKSPACE,
            workflow_id=ROBOFLOW_WORKFLOW_ID,
            images={"image": inference_input},
            parameters={"classes": ROBOFLOW_CLASSES},
            use_cache=True,
        )
    return _normalize(model_result, workflow_result)


@app.get("/health")
def health():
    configured = bool(os.environ.get("ROBOFLOW_API_KEY", "").strip())
    return {
        "status": "ok" if configured else "degraded",
        "roboflow": "configured" if configured else "not_configured",
        "model_id": ROBOFLOW_MODEL_ID,
        "workflow_id": ROBOFLOW_WORKFLOW_ID,
    }, HTTPStatus.OK if configured else HTTPStatus.SERVICE_UNAVAILABLE


@app.post("/infer")
def infer():
    image = request.files.get("file")
    if image is None:
        return {"error": "missing_file"}, HTTPStatus.BAD_REQUEST
    data = image.read(MAX_BYTES + 1)
    if not data:
        return {"error": "empty_file"}, HTTPStatus.BAD_REQUEST
    if len(data) > MAX_BYTES:
        return {"error": "payload_too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE

    suffix = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(image.mimetype, ".img")
    run_workflow = str(request.form.get("workflow", "1")).lower() not in {"0", "false", "no"}

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix) as temp:
            temp.write(data)
            temp.flush()
            return _run(temp.name, run_workflow=run_workflow)
    except Exception as exc:
        app.logger.exception("Roboflow dog vision failed")
        return {
            "error": "roboflow_inference_failed",
            "detail": f"{type(exc).__name__}: {str(exc)[:200]}",
        }, HTTPStatus.BAD_GATEWAY


def _smoke_test():
    image_url = os.environ.get("ROBOFLOW_SMOKE_IMAGE_URL", "").strip()
    if not image_url or not os.environ.get("ROBOFLOW_API_KEY", "").strip():
        return
    try:
        summary = _run(image_url, run_workflow=True)
        print(
            "roboflow smoke result: "
            + json.dumps(
                {
                    "model_id": summary["model_id"],
                    "workflow_id": summary["workflow_id"],
                    "dog_detected": summary["dog_detected"],
                    "detection_count": summary["detection_count"],
                    "segmentation_count": summary["segmentation_count"],
                    "max_confidence": summary["max_confidence"],
                    "largest_subject_fraction": summary["largest_subject_fraction"],
                },
                sort_keys=True,
            ),
            flush=True,
        )
    except Exception as exc:
        print(f"roboflow smoke failed: {type(exc).__name__}: {str(exc)[:300]}", flush=True)


if os.environ.get("ROBOFLOW_SMOKE_IMAGE_URL", "").strip():
    threading.Thread(target=_smoke_test, daemon=True).start()


if __name__ == "__main__":
    from waitress import serve
    serve(app, host="127.0.0.1", port=PORT, threads=2)
