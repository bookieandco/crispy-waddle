"""Private PupsonStuff image-edit bridge to an operator-owned ComfyUI/Unsloth GGUF runtime.

ComfyUI image-edit workflows must be explicitly exported in API format and reviewed.
No model download, hosted GPU purchase, or public port exposure is performed.
"""
from __future__ import annotations

import base64
import binascii
import copy
import hmac
import io
import json
import os
import re
from pathlib import Path
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

SCHEMA_REQUEST = "pupson.local-image-edit.v1"
SCHEMA_RESULT = "pupson.local-image-edit-result.v1"
MAX_REQUEST = 45 * 1024 * 1024
MAX_SOURCE = 10 * 1024 * 1024
MAX_OUTPUT = 20 * 1024 * 1024
MAX_PROMPT = 8000
Image.MAX_IMAGE_PIXELS = 40_000_000


class ProtocolError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    token: str
    model: str
    workflow_path: Path
    prompt_node: str
    input_nodes: tuple[str, ...]
    output_node: str
    comfy_url: str
    input_dir: Path
    output_dir: Path
    timeout: int
    prompt_field: str = "text"

    @classmethod
    def load(cls) -> "Config":
        env = os.environ
        token = env.get("PUPSON_LOCAL_IMAGE_WORKER_TOKEN", "")
        model = env.get("PUPSON_LOCAL_IMAGE_MODEL", "")
        workflow = env.get("PUPSON_COMFY_WORKFLOW_PATH", "")
        prompt = env.get("PUPSON_COMFY_PROMPT_NODE", "")
        prompt_field = env.get("PUPSON_COMFY_PROMPT_FIELD", "text")
        if not re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]{0,39}", prompt_field):
            raise ValueError("ComfyUI prompt field name is invalid.")
        inputs = tuple(x.strip() for x in env.get("PUPSON_COMFY_INPUT_NODES", "").split(",") if x.strip())
        output = env.get("PUPSON_COMFY_OUTPUT_NODE", "")
        url = env.get("PUPSON_COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
        u = urlparse(url)
        # No network egress: the daemon can only talk to ComfyUI on the same host.
        if u.scheme != "http" or u.hostname not in ("localhost", "127.0.0.1", "::1") or u.username or u.password or u.query or u.fragment or u.path:
            raise ValueError("ComfyUI must be bound to local loopback, not a remote URL.")
        if len(token) < 32 or not model or len(model) > 200:
            raise ValueError("A strong token and pinned model are required.")
        if not workflow or not prompt or not output or len(inputs) not in (1, 2, 3):
            raise ValueError("An API workflow, text node, 1–3 image nodes, and output node are required.")
        input_dir = Path(env.get("PUPSON_COMFY_INPUT_DIR", "")).resolve() if env.get("PUPSON_COMFY_INPUT_DIR") else None
        output_dir = Path(env.get("PUPSON_COMFY_OUTPUT_DIR", "")).resolve() if env.get("PUPSON_COMFY_OUTPUT_DIR") else None
        if input_dir is None or output_dir is None or not input_dir.is_dir() or not output_dir.is_dir():
            raise ValueError("Both ComfyUI input/output directories must exist to enforce cleanup.")
        timeout = int(env.get("PUPSON_COMFY_TIMEOUT_SEC", "75"))
        if not 5 <= timeout <= 80:
            raise ValueError("The synchronous bridge deadline must be between 5 and 80 seconds.")
        path = Path(workflow).resolve()
        if not path.is_file():
            raise ValueError("The reviewed ComfyUI API workflow is missing.")
        return cls(token, model, path, prompt, inputs, output, url, input_dir, output_dir, timeout, prompt_field)


def normalize_image(encoded: str) -> bytes:
    if not isinstance(encoded, str) or len(encoded) > (MAX_SOURCE * 4 // 3 + 8):
        raise ProtocolError("Invalid reference image.")
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if not decoded or len(decoded) > MAX_SOURCE:
            raise ProtocolError("Invalid reference image size.")
        with Image.open(io.BytesIO(decoded)) as img:
            if img.format not in ("PNG", "JPEG", "WEBP"):
                raise ProtocolError("Unsupported reference image.")
            img.verify()
        with Image.open(io.BytesIO(decoded)) as img:
            if not 1 <= img.width <= 8192 or not 1 <= img.height <= 8192:
                raise ProtocolError("Invalid image dimensions.")
            corrected = ImageOps.exif_transpose(img)
            corrected.thumbnail((3072, 3072), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            corrected.convert("RGBA" if "A" in corrected.getbands() else "RGB").save(output, "PNG")
            image = output.getvalue()
            if len(image) > MAX_SOURCE:
                raise ProtocolError("Normalized image too large.")
            return image
    except (binascii.Error, ValueError, OSError, UnidentifiedImageError) as exc:
        raise ProtocolError("Invalid reference image content.") from exc


def normalize_output(output: bytes) -> bytes:
    if not output or len(output) > MAX_OUTPUT:
        raise ProtocolError("ComfyUI image output invalid or oversized.")
    try:
        with Image.open(io.BytesIO(output)) as im:
            if im.format not in ("PNG", "JPEG", "WEBP"):
                raise ProtocolError("Unsupported ComfyUI image format.")
            if im.width > 8192 or im.height > 8192:
                raise ProtocolError("ComfyUI output dimensions exceed limit.")
            im.load()
            buf = io.BytesIO()
            im.save(buf, "PNG")
            normalized = buf.getvalue()
        if len(normalized) > MAX_OUTPUT:
            raise ProtocolError("ComfyUI output is too large.")
        return normalized
    except (OSError, ValueError, UnidentifiedImageError) as exc:
        raise ProtocolError("Invalid ComfyUI image output.") from exc


def validate_request(payload: object, cfg: Config) -> tuple[str, list[bytes]]:
    if not isinstance(payload, dict) or payload.get("schema") != SCHEMA_REQUEST or payload.get("engine") != "unsloth":
        raise ProtocolError("Image protocol mismatch.")
    if payload.get("model") != cfg.model:
        raise ProtocolError("Image model mismatch.")
    prompt, refs = payload.get("prompt"), payload.get("reference_images")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > MAX_PROMPT:
        raise ProtocolError("Invalid creative prompt.")
    if not isinstance(refs, list) or not 1 <= len(refs) <= 3:
        raise ProtocolError("One to three reference images required.")
    decoded = []
    for ref in refs:
        if not isinstance(ref, dict) or ref.get("mime_type") not in ("image/jpeg", "image/png", "image/webp"):
            raise ProtocolError("Invalid image MIME type.")
        decoded.append(normalize_image(ref.get("image_base64")))
    return prompt, decoded


def _fetch(base: str, path: str, *, body: bytes | None = None, content_type: str | None = None, deadline: float = 10, max_bytes: int = MAX_OUTPUT) -> bytes:
    headers = {"Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = Request(base + path, data=body, headers=headers, method="POST" if body is not None else "GET")
    with urlopen(req, timeout=deadline) as response:
        data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise ProtocolError("ComfyUI response exceeded size limit.")
        return data


def _upload(base: str, filename: str, data: bytes, deadline: float) -> None:
    boundary = "pupson-" + uuid4().hex
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        "Content-Type: image/png\r\n\r\n"
    ).encode()
    body = header + data + f"\r\n--{boundary}--\r\n".encode()
    result = json.loads(_fetch(base, "/upload/image", body=body,
                     content_type=f"multipart/form-data; boundary={boundary}", deadline=deadline, max_bytes=4096))
    if result.get("name") != filename or result.get("subfolder", "") != "":
        raise ProtocolError("ComfyUI did not retain the isolated upload filename.")


def _workflow(cfg: Config, request_id: str, filenames: list[str], prompt: str) -> dict:
    graph = json.loads(cfg.workflow_path.read_text(encoding="utf-8"))
    if not isinstance(graph, dict):
        raise ProtocolError("ComfyUI workflow must be an exported API graph.")
    graph = copy.deepcopy(graph)
    if not all(x in graph and isinstance(graph[x].get("inputs"), dict) for x in (cfg.prompt_node, cfg.output_node, *cfg.input_nodes)):
        raise ProtocolError("Required workflow nodes are missing.")
    if cfg.prompt_field not in graph[cfg.prompt_node]["inputs"]:
        raise ProtocolError("Configured prompt node has no text input.")
    if graph[cfg.output_node].get("class_type") != "SaveImage":
        raise ProtocolError("Output node must be SaveImage for private cleanup.")
    graph[cfg.prompt_node]["inputs"][cfg.prompt_field] = prompt
    for i, node_id in enumerate(cfg.input_nodes):
        if graph[node_id].get("class_type") != "LoadImage":
            raise ProtocolError("Image inputs must be LoadImage nodes.")
        graph[node_id]["inputs"]["image"] = filenames[min(i, len(filenames) - 1)]
    graph[cfg.output_node]["inputs"]["filename_prefix"] = request_id
    return graph


def generate_with_comfy(cfg: Config, prompt: str, refs: list[bytes]) -> bytes:
    request_id = "pupson-" + uuid4().hex
    filenames = [f"{request_id}-{i}.png" for i in range(len(refs))]
    output_file: str | None = None
    cutoff = time.monotonic() + cfg.timeout
    try:
        graph = _workflow(cfg, request_id, filenames, prompt)
        for name, content in zip(filenames, refs):
            _upload(cfg.comfy_url, name, content, min(10, max(1, cutoff - time.monotonic())))
        body = json.dumps({"prompt": graph, "client_id": request_id}).encode()
        info = json.loads(_fetch(cfg.comfy_url, "/prompt", body=body, content_type="application/json",
                        deadline=min(10, max(1, cutoff - time.monotonic())), max_bytes=16384))
        prompt_id = info.get("prompt_id")
        if not isinstance(prompt_id, str) or not prompt_id:
            raise ProtocolError("ComfyUI did not accept the reviewed workflow.")
        while time.monotonic() < cutoff:
            raw = _fetch(cfg.comfy_url, "/history/" + quote(prompt_id, safe=""),
                         deadline=min(10, max(1, cutoff - time.monotonic())), max_bytes=200_000)
            history = json.loads(raw).get(prompt_id)
            if history:
                images = history.get("outputs", {}).get(cfg.output_node, {}).get("images", [])
                if not images:
                    raise ProtocolError("ComfyUI workflow returned no output image.")
                chosen = images[0]
                name = chosen.get("filename", "")
                if not isinstance(name, str) or not name.startswith(request_id + "_") or "/" in name or "\\" in name or chosen.get("subfolder", "") != "" or chosen.get("type") != "output":
                    raise ProtocolError("ComfyUI returned an unexpected image locator.")
                output_file = name
                query = urlencode({"filename": name, "subfolder": "", "type": "output"})
                result = _fetch(cfg.comfy_url, "/view?" + query,
                                deadline=min(10, max(1, cutoff - time.monotonic())), max_bytes=MAX_OUTPUT)
                return normalize_output(result)
            time.sleep(0.5)
        raise ProtocolError("ComfyUI generation exceeded its safe response deadline.")
    finally:
        for name in filenames:
            try:
                (cfg.input_dir / name).unlink(missing_ok=True)
            except OSError:
                pass
        if output_file:
            try:
                (cfg.output_dir / output_file).unlink(missing_ok=True)
            except OSError:
                pass


# The endpoint attempts immediate cleanup. ComfyUI may complete after a
# timed-out request: a local TTL sweeper removes its delayed output without
# touching other ComfyUI users' files. Use an isolated image-edit instance.
SOURCE_NAME = re.compile(r"^pupson-[0-9a-f]{32}-[0-2]\.png$")
OUTPUT_NAME = re.compile(r"^pupson-[0-9a-f]{32}_[A-Za-z0-9_.-]{1,100}\.png$")


def reap_stale_files(cfg: Config, *, now: float | None = None, ttl_seconds: int = 1800) -> int:
    cutoff = (time.time() if now is None else now) - ttl_seconds
    removed = 0
    for folder, pattern in ((cfg.input_dir, SOURCE_NAME), (cfg.output_dir, OUTPUT_NAME)):
        for file in folder.iterdir():
            if not pattern.fullmatch(file.name):
                continue
            try:
                if file.stat(follow_symlinks=False).st_mtime < cutoff:
                    file.unlink(missing_ok=True)
                    removed += 1
            except (OSError, FileNotFoundError):
                # Do not log user file names. A later pass can retry cleanup.
                pass
    return removed


def run_cleanup_loop(cfg: Config) -> None:
    while True:
        try:
            reap_stale_files(cfg)
        except OSError:
            pass
        threading.Event().wait(300)


class ImageRequestHandler(BaseHTTPRequestHandler):
    # ThreadingHTTPServer is used only for connection handling; inference is serialized.
    cfg: Config
    lock = threading.Lock()

    def log_message(self, format: str, *args: object) -> None:
        # Do not record requests, source identifiers, pet data or prompts.
        return

    def reply(self, status: int, value: dict) -> None:
        data = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path != "/healthz":
            self.reply(404, {"error": "Not found."})
            return
        # Only reachability; health does not certify real GPU inference.
        self.reply(200, {"status": "ready", "model": self.cfg.model, "inference_certified": False})

    def do_POST(self) -> None:
        if self.path != "/v1/pupson/image/edit":
            self.reply(404, {"error": "Not found."})
            return
        authorization = self.headers.get("Authorization", "")
        if not hmac.compare_digest(authorization, "Bearer " + self.cfg.token):
            self.reply(401, {"error": "Unauthorized."})
            return
        if self.headers.get("Transfer-Encoding"):
            self.reply(400, {"error": "Request framing rejected."})
            return
        try:
            size = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            size = -1
        if size < 1 or size > MAX_REQUEST:
            self.reply(413, {"error": "Invalid request size."})
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            self.reply(415, {"error": "Expected JSON."})
            return
        if not self.lock.acquire(blocking=False):
            self.reply(503, {"error": "Image worker busy; retry later."})
            return
        try:
            payload = json.loads(self.rfile.read(size))
            prompt, images = validate_request(payload, self.cfg)
            result = generate_with_comfy(self.cfg, prompt, images)
            self.reply(200, {
                "schema": SCHEMA_RESULT,
                "engine": "unsloth",
                "model": self.cfg.model,
                "image_base64": base64.b64encode(result).decode("ascii"),
            })
        except (ProtocolError, json.JSONDecodeError, UnicodeDecodeError):
            self.reply(422, {"error": "Image request invalid or generation unavailable."})
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            self.reply(502, {"error": "Image inference service unavailable."})
        finally:
            self.lock.release()


def main() -> None:
    cfg = Config.load()
    ImageRequestHandler.cfg = cfg
    host = os.getenv("PUPSON_IMAGE_BIND", "127.0.0.1")
    if host not in ("localhost", "127.0.0.1", "::1") and os.getenv("PUPSON_ALLOW_NONLOCAL_BIND") != "1":
        raise ValueError("External binding requires explicit opt-in and a private authenticated HTTPS ingress.")
    port = int(os.getenv("PUPSON_IMAGE_PORT", "8789"))
    threading.Thread(target=run_cleanup_loop, args=(cfg,), daemon=True).start()
    ThreadingHTTPServer((host, port), ImageRequestHandler).serve_forever()


if __name__ == "__main__":
    main()
