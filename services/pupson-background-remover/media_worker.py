import io
import json
import os
import signal
import subprocess
import tempfile
import threading
import time
from http import HTTPStatus
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from flask import Flask, Response, request
from inference_sdk import InferenceConfiguration, InferenceHTTPClient

PORT = int(os.environ.get("PORT", "5000"))
BACKGROUND_URL = "http://127.0.0.1:5001/"
UPSCALER_URL = "http://127.0.0.1:8311"
MAX_BYTES = 15 * 1024 * 1024

ROBOFLOW_API_URL = os.environ.get("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
ROBOFLOW_MODEL_ID = os.environ.get("ROBOFLOW_DOG_MODEL_ID", "dogs-gxbwe/1")
ROBOFLOW_WORKSPACE = os.environ.get("ROBOFLOW_WORKSPACE", "morrisdorian84-gmail-com")
ROBOFLOW_WORKFLOW_ID = os.environ.get("ROBOFLOW_DOG_WORKFLOW_ID", "general-segmentation-api")
ROBOFLOW_CLASSES = os.environ.get("ROBOFLOW_DOG_CLASSES", "dog")
ROBOFLOW_REQUIRED = os.environ.get("PUPSON_ROBOFLOW_REQUIRED", "0").strip().lower() in {
    "1",
    "true",
    "yes",
}

app = Flask(__name__)

children = [
    subprocess.Popen([
        "python", "-m", "backgroundremover.cmd.server",
        "--addr", "127.0.0.1", "--port", "5001",
    ]),
    subprocess.Popen([
        "real-esrgan-serve", "serve",
        "--bind", "127.0.0.1",
        "--port", "8311",
        "--gpu-id", "-1",
        "--concurrency", "1",
    ]),
]


def _shutdown(*_args):
    for child in children:
        if child.poll() is None:
            child.terminate()
    deadline = time.time() + 5
    for child in children:
        if child.poll() is None:
            remaining = max(0.1, deadline - time.time())
            try:
                child.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                child.kill()
    raise SystemExit(0)


signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)


def _watch_children():
    while True:
        for child in children:
            code = child.poll()
            if code is not None:
                os._exit(code or 1)
        time.sleep(1)


threading.Thread(target=_watch_children, daemon=True).start()


def _probe(url, accepted):
    try:
        req = urlrequest.Request(url, method="GET")
        with urlrequest.urlopen(req, timeout=5) as response:
            return response.status in accepted
    except HTTPError as exc:
        return exc.code in accepted
    except (URLError, TimeoutError):
        return False


def _proxy(url):
    declared = request.content_length or 0
    if declared > MAX_BYTES:
        return Response(
            json.dumps({"error": "payload_too_large"}),
            status=413,
            content_type="application/json",
        )

    body = request.get_data(cache=False)
    if len(body) > MAX_BYTES:
        return Response(
            json.dumps({"error": "payload_too_large"}),
            status=413,
            content_type="application/json",
        )

    headers = {}
    if request.content_type:
        headers["Content-Type"] = request.content_type

    upstream = urlrequest.Request(
        url,
        data=body,
        headers=headers,
        method="POST",
    )

    try:
        with urlrequest.urlopen(upstream, timeout=180) as response:
            output = response.read()
            return Response(
                output,
                status=response.status,
                content_type=response.headers.get_content_type(),
                headers={"Cache-Control": "no-store"},
            )
    except HTTPError as exc:
        return Response(
            exc.read(),
            status=exc.code,
            content_type=exc.headers.get_content_type() if exc.headers else "text/plain",
            headers={"Cache-Control": "no-store"},
        )
    except (URLError, TimeoutError):
        return Response(
            json.dumps({"error": "upstream_failure"}),
            status=502,
            content_type="application/json",
        )


_roboflow_client = None
_roboflow_client_lock = threading.Lock()


def _get_roboflow_client():
    global _roboflow_client
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured.")

    if _roboflow_client is None:
        with _roboflow_client_lock:
            if _roboflow_client is None:
                _roboflow_client = InferenceHTTPClient(
                    api_url=ROBOFLOW_API_URL,
                    api_key=api_key,
                ).configure(
                    InferenceConfiguration(api_key_transport="header")
                )
    return _roboflow_client


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
    looks_like_prediction = class_name is not None or confidence is not None
    if looks_like_prediction:
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


def _dedupe_predictions(predictions):
    seen = set()
    output = []
    for item in predictions:
        marker = json.dumps(item, sort_keys=True, separators=(",", ":"))
        if marker in seen:
            continue
        seen.add(marker)
        output.append(item)
    return output


def _normalize_roboflow(model_result, workflow_result):
    model_predictions = []
    workflow_predictions = []
    _collect_prediction_like(model_result, model_predictions)
    if workflow_result is not None:
        _collect_prediction_like(workflow_result, workflow_predictions)

    model_predictions = _dedupe_predictions(model_predictions)
    workflow_predictions = _dedupe_predictions(workflow_predictions)

    image = model_result.get("image", {}) if isinstance(model_result, dict) else {}
    image_width = _safe_float(image.get("width")) if isinstance(image, dict) else None
    image_height = _safe_float(image.get("height")) if isinstance(image, dict) else None

    confidences = [
        item["confidence"]
        for item in model_predictions + workflow_predictions
        if isinstance(item.get("confidence"), (float, int))
    ]
    max_confidence = max(confidences) if confidences else None

    coverage = []
    if image_width and image_height and image_width > 0 and image_height > 0:
        image_area = image_width * image_height
        for item in model_predictions:
            width = item.get("width")
            height = item.get("height")
            if isinstance(width, (float, int)) and isinstance(height, (float, int)):
                coverage.append(max(0.0, min(1.0, (width * height) / image_area)))

    return {
        "status": "ok",
        "model_id": ROBOFLOW_MODEL_ID,
        "workflow_id": ROBOFLOW_WORKFLOW_ID if workflow_result is not None else None,
        "workspace": ROBOFLOW_WORKSPACE if workflow_result is not None else None,
        "dog_detected": bool(model_predictions or workflow_predictions),
        "detection_count": len(model_predictions),
        "segmentation_count": len(workflow_predictions),
        "max_confidence": max_confidence,
        "largest_subject_fraction": max(coverage) if coverage else None,
        "predictions": model_predictions[:20],
        "segments": workflow_predictions[:20],
    }


def _run_roboflow_on_input(inference_input, run_workflow=True):
    client = _get_roboflow_client()
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
    return _normalize_roboflow(model_result, workflow_result)


def _run_roboflow_bytes(data, mime_type, run_workflow=True):
    suffix = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(mime_type, ".img")
    with tempfile.NamedTemporaryFile(suffix=suffix) as temp:
        temp.write(data)
        temp.flush()
        return _run_roboflow_on_input(temp.name, run_workflow=run_workflow)


def _roboflow_smoke_test():
    image_url = os.environ.get("ROBOFLOW_SMOKE_IMAGE_URL", "").strip()
    if not image_url or not os.environ.get("ROBOFLOW_API_KEY", "").strip():
        return
    try:
        summary = _run_roboflow_on_input(image_url, run_workflow=True)
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
        print(
            f"roboflow smoke failed: {type(exc).__name__}: {str(exc)[:300]}",
            flush=True,
        )


@app.get("/health")
def health():
    background = _probe(BACKGROUND_URL, {200, 400})
    upscaler = _probe(f"{UPSCALER_URL}/health", {200})
    roboflow_configured = bool(os.environ.get("ROBOFLOW_API_KEY", "").strip())
    healthy = background and upscaler and (roboflow_configured or not ROBOFLOW_REQUIRED)
    return (
        {
            "status": "ok" if healthy else "degraded",
            "background_remover": "reachable" if background else "unreachable",
            "upscaler": "reachable" if upscaler else "unreachable",
            "roboflow": "configured" if roboflow_configured else "not_configured",
            "roboflow_model": ROBOFLOW_MODEL_ID,
            "roboflow_workflow": ROBOFLOW_WORKFLOW_ID,
        },
        HTTPStatus.OK if healthy else HTTPStatus.SERVICE_UNAVAILABLE,
    )


@app.post("/background")
def background():
    suffix = f"?{request.query_string.decode()}" if request.query_string else ""
    return _proxy(f"{BACKGROUND_URL}{suffix}")


@app.post("/upscale")
def upscale():
    suffix = f"?{request.query_string.decode()}" if request.query_string else ""
    return _proxy(f"{UPSCALER_URL}/upscale{suffix}")


@app.post("/dog-vision")
def dog_vision():
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        return {"error": "roboflow_not_configured"}, HTTPStatus.SERVICE_UNAVAILABLE

    image = request.files.get("file")
    if image is None:
        return {"error": "missing_file"}, HTTPStatus.BAD_REQUEST

    data = image.read(MAX_BYTES + 1)
    if not data:
        return {"error": "empty_file"}, HTTPStatus.BAD_REQUEST
    if len(data) > MAX_BYTES:
        return {"error": "payload_too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE

    run_workflow = str(request.form.get("workflow", "1")).lower() not in {
        "0",
        "false",
        "no",
    }
    try:
        return _run_roboflow_bytes(
            data,
            image.mimetype or "application/octet-stream",
            run_workflow=run_workflow,
        )
    except Exception as exc:
        app.logger.exception("Roboflow dog vision failed")
        return (
            {
                "error": "roboflow_inference_failed",
                "detail": f"{type(exc).__name__}: {str(exc)[:200]}",
            },
            HTTPStatus.BAD_GATEWAY,
        )


@app.errorhandler(404)
def not_found(_error):
    return {"error": "not_found"}, HTTPStatus.NOT_FOUND


if os.environ.get("ROBOFLOW_SMOKE_IMAGE_URL", "").strip():
    threading.Thread(target=_roboflow_smoke_test, daemon=True).start()


if __name__ == "__main__":
    from waitress import serve

    # Explicit dual-stack sockets keep Railway health routing and private
    # service-to-service traffic on the same worker.
    serve(app, listen=f"0.0.0.0:{PORT} [::]:{PORT}", threads=4)
