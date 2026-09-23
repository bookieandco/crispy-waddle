import io
import hmac
import json
import os
import signal
import subprocess
import threading
import time
from http import HTTPStatus
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from flask import Flask, Response, request

PORT = int(os.environ.get("PORT", "5000"))
WORKER_PORT = int(os.environ.get("PUPSON_MEDIA_WORKER_LOCAL_PORT", "5003"))
BACKGROUND_URL = "http://127.0.0.1:5001/"
UPSCALER_URL = "http://127.0.0.1:8311"
ROBOFLOW_URL = "http://127.0.0.1:5002"
MAX_BYTES = 15 * 1024 * 1024
MEDIA_GATEWAY_TOKEN = os.environ.get("PUPSON_MEDIA_GATEWAY_TOKEN", "").strip()

if len(MEDIA_GATEWAY_TOKEN) < 32:
    raise RuntimeError("PUPSON_MEDIA_GATEWAY_TOKEN must be at least 32 characters.")

ROBOFLOW_MODEL_ID = os.environ.get("ROBOFLOW_DOG_MODEL_ID", "dogs-gxbwe/1")
ROBOFLOW_WORKFLOW_ID = os.environ.get("ROBOFLOW_DOG_WORKFLOW_ID", "general-segmentation-api")
ROBOFLOW_REQUIRED = os.environ.get("PUPSON_ROBOFLOW_REQUIRED", "0").strip().lower() in {
    "1", "true", "yes"
}

app = Flask(__name__)

NGINX_CONFIG = f"""
worker_processes 1;
pid /tmp/pupson-nginx.pid;
error_log /dev/stderr warn;

events {{
    worker_connections 1024;
}}

http {{
    access_log /dev/stdout;
    client_max_body_size 15m;
    proxy_connect_timeout 10s;
    proxy_read_timeout 190s;
    proxy_send_timeout 190s;

    server {{
        listen 0.0.0.0:{PORT};
        listen [::]:{PORT};
        server_name _;

        location / {{
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header Authorization $http_authorization;
            proxy_set_header Content-Type $content_type;
            proxy_set_header Content-Length $content_length;
            proxy_pass http://127.0.0.1:{WORKER_PORT};
        }}
    }}
}}
"""

with open("/tmp/pupson-nginx.conf", "w", encoding="utf-8") as nginx_config:
    nginx_config.write(NGINX_CONFIG)

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
    subprocess.Popen([
        "/opt/roboflow-venv/bin/python",
        "/opt/pupson/roboflow_worker.py",
    ]),
    subprocess.Popen([
        "nginx",
        "-c", "/tmp/pupson-nginx.conf",
        "-g", "daemon off;",
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


def _inference_authorized():
    authorization = request.headers.get("Authorization", "")
    expected = f"Bearer {MEDIA_GATEWAY_TOKEN}"
    return hmac.compare_digest(authorization, expected)


@app.before_request
def _protect_inference_routes():
    if request.method == "POST" and request.path in {
        "/background", "/upscale", "/dog-vision"
    }:
        if not _inference_authorized():
            return {"error": "unauthorized"}, HTTPStatus.UNAUTHORIZED
    return None


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



@app.get("/health")
def health():
    background = _probe(BACKGROUND_URL, {200, 400})
    upscaler = _probe(f"{UPSCALER_URL}/health", {200})
    roboflow = _probe(f"{ROBOFLOW_URL}/health", {200})
    healthy = background and upscaler and (roboflow or not ROBOFLOW_REQUIRED)
    return (
        {
            "status": "ok" if healthy else "degraded",
            "background_remover": "reachable" if background else "unreachable",
            "upscaler": "reachable" if upscaler else "unreachable",
            "roboflow": "reachable" if roboflow else "unavailable",
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
    return _proxy(f"{ROBOFLOW_URL}/infer")


@app.errorhandler(404)
def not_found(_error):
    return {"error": "not_found"}, HTTPStatus.NOT_FOUND


if __name__ == "__main__":
    from waitress import serve

    # Keep the authenticated Python API on loopback. nginx owns Railway's
    # public/private ingress port and proxies requests into this worker.
    serve(app, host="127.0.0.1", port=WORKER_PORT, threads=4)
