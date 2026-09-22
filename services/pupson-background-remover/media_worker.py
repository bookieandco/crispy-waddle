import io
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
BACKGROUND_URL = "http://127.0.0.1:5001/"
UPSCALER_URL = "http://127.0.0.1:8311"
MAX_BYTES = 15 * 1024 * 1024

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


@app.get("/health")
def health():
    background = _probe(BACKGROUND_URL, {200, 400})
    upscaler = _probe(f"{UPSCALER_URL}/health", {200})
    healthy = background and upscaler
    return (
        {
            "status": "ok" if healthy else "degraded",
            "background_remover": "reachable" if background else "unreachable",
            "upscaler": "reachable" if upscaler else "unreachable",
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


@app.errorhandler(404)
def not_found(_error):
    return {"error": "not_found"}, HTTPStatus.NOT_FOUND


if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=PORT, threads=4)
