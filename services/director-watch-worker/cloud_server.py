from __future__ import annotations

import json
import os
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse, unquote

from handler import handler as run_watch_job


HOST = os.getenv("DIRECTOR_WATCH_SIDECAR_BIND", "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.getenv("DIRECTOR_WATCH_SIDECAR_PORT", "8094"))
MAX_QUEUE = max(1, min(16, int(os.getenv("DIRECTOR_WATCH_SIDECAR_MAX_QUEUE", "2"))))
PRODUCTION_READY_FLAG = (
    os.getenv("DIRECTOR_WATCH_SIDECAR_PRODUCTION_READY", "true").strip().lower()
    in {"1", "true", "yes"}
)

jobs: "queue.Queue[dict[str, Any]]" = queue.Queue(maxsize=MAX_QUEUE)
state: dict[str, dict[str, Any]] = {}
state_lock = threading.Lock()


def vlm_ready() -> bool:
    backend = os.getenv("DIRECTOR_WATCH_VLM_BACKEND", "local-qwen").strip().lower()
    if backend == "local-qwen":
        model_path = (
            os.getenv("DIRECTOR_WATCH_QWEN_MODEL_PATH", "").strip()
            or os.getenv("DIRECTOR_WATCH_LOCAL_QWEN_MODEL", "").strip()
            or "/workspace/jhadina/models/HunyuanVideo-1.5/text_encoder/llm"
        )
        return bool(model_path and os.path.exists(model_path))
    if backend == "openai-compatible":
        return bool(
            os.getenv("DIRECTOR_WATCH_VLM_URL", "").strip()
            and os.getenv("DIRECTOR_WATCH_VLM_MODEL", "").strip()
        )
    return False


def production_ready() -> bool:
    return bool(PRODUCTION_READY_FLAG and vlm_ready())


def set_state(job_id: str, **patch: Any) -> None:
    with state_lock:
        current = state.get(job_id, {})
        state[job_id] = {**current, **patch}


def worker_loop() -> None:
    while True:
        job = jobs.get()
        try:
            payload = job.get("input") if isinstance(job, dict) else None
            job_id = str(payload.get("jobId", "")) if isinstance(payload, dict) else ""
            if job_id:
                set_state(job_id, status="running")
            result = run_watch_job(job)
            if job_id:
                set_state(job_id, status="completed", result=result)
        except Exception as exc:
            payload = job.get("input") if isinstance(job, dict) else None
            job_id = str(payload.get("jobId", "")) if isinstance(payload, dict) else ""
            if job_id:
                set_state(job_id, status="failed", error=type(exc).__name__)
        finally:
            jobs.task_done()


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "JhadinaDirectorWatchSidecar/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        if os.getenv("DIRECTOR_WATCH_SIDECAR_ACCESS_LOG", "").strip().lower() in {"1", "true", "yes"}:
            super().log_message(fmt, *args)

    def json_response(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.json_response(200, {
                "ok": True,
                "productionReady": production_ready(),
                "queueDepth": jobs.qsize(),
                "queueCapacity": MAX_QUEUE,
                "vlmReady": vlm_ready(),
                "sourceAuthority": "AUTHORIZED_PUBLIC_HTTPS_ONLY",
            })
            return
        if parsed.path.startswith("/v1/jobs/"):
            job_id = unquote(parsed.path[len("/v1/jobs/"):]).strip()
            with state_lock:
                current = state.get(job_id)
            if not current:
                self.json_response(404, {"ok": False, "error": "DIRECTOR_WATCH_JOB_NOT_FOUND"})
                return
            self.json_response(200, {"ok": True, "jobId": job_id, **current})
            return
        self.json_response(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/v1/jobs":
            self.json_response(404, {"ok": False, "error": "not_found"})
            return
        if not production_ready():
            self.json_response(503, {"ok": False, "error": "DIRECTOR_WATCH_SIDECAR_NOT_PRODUCTION_READY"})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > 1_048_576:
                raise ValueError("body size")
            body = json.loads(self.rfile.read(length))
            payload = body.get("input") if isinstance(body, dict) else None
            if not isinstance(payload, dict):
                raise ValueError("input")
            job_id = str(payload.get("jobId", "")).strip()
            if not job_id:
                raise ValueError("jobId")
        except (ValueError, json.JSONDecodeError):
            self.json_response(400, {"ok": False, "error": "DIRECTOR_WATCH_REQUEST_INVALID"})
            return

        with state_lock:
            existing = state.get(job_id)
        if existing:
            self.json_response(200, {
                "ok": True,
                "jobId": job_id,
                "status": existing.get("status", "accepted"),
                "reused": True,
            })
            return

        try:
            jobs.put_nowait(body)
        except queue.Full:
            self.json_response(429, {"ok": False, "error": "DIRECTOR_WATCH_QUEUE_FULL"})
            return

        set_state(job_id, status="accepted")
        self.json_response(202, {"ok": True, "jobId": job_id, "status": "accepted", "reused": False})


def main() -> None:
    if HOST not in {"127.0.0.1", "::1", "localhost"}:
        raise RuntimeError("DIRECTOR_WATCH_SIDECAR_LOOPBACK_BIND_REQUIRED")
    thread = threading.Thread(target=worker_loop, name="director-watch-sidecar-worker", daemon=True)
    thread.start()
    server = ThreadingHTTPServer((HOST, PORT), RequestHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
