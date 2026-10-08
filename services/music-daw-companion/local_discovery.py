"""Local-only companion scanner. Read-only plugin inventory, NO VST execution.

Example laptop:
MUSIC_DAW_COMPANION_TOKEN=<random long secret> \
MUSIC_DAW_ALLOWED_ORIGIN=https://your-jhadina-app.example \
python3 services/music-daw-companion/local_discovery.py
Do not paste your token into ChatGPT or expose this listener on any network.
"""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import base64
import hashlib
import hmac
import importlib.util
import json
import os
import subprocess
import sys
import tempfile

from scan_plugins import discover_installed_plugins

PORT = 47471


def create_handler(secret: str, allowed_origin: str):
    if len(secret) < 24 or not allowed_origin.startswith("https://"):
        raise ValueError("MUSIC_DAW_COMPANION_TOKEN_AND_HTTPS_ORIGIN_REQUIRED")

    class Handler(BaseHTTPRequestHandler):
        def _headers(self, status: int):
            self.send_response(status)
            origin = self.headers.get("Origin", "")
            if origin and origin == allowed_origin:
                self.send_header("Access-Control-Allow-Origin", allowed_origin)
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Type", "application/json")
            self.end_headers()

        def do_OPTIONS(self):
            if self.path not in ("/v1/plugins", "/v1/render") or self.headers.get("Origin") != allowed_origin:
                self._headers(403)
            else:
                self._headers(204)

        def do_GET(self):
            origin = self.headers.get("Origin")
            bearer = self.headers.get("Authorization", "")
            if (self.path != "/v1/plugins" or origin != allowed_origin or
                    not hmac.compare_digest(bearer, "Bearer " + secret)):
                self._headers(403)
                self.wfile.write(b'{"error":"NOT_AUTHORIZED"}')
                return
            plugins = discover_installed_plugins(secret)
            self._headers(200)
            body = {
                "schema": "jhadina-music-daw-local-plugin-scanner/v1",
                "hostConnected": True,
                "renderReady": (os.environ.get("MUSIC_DAW_NATIVE_RENDER_ENABLED")=="YES"
                                and importlib.util.find_spec("dawdreamer") is not None),
                "nativeAudioExecutionAvailable": (os.environ.get("MUSIC_DAW_NATIVE_RENDER_ENABLED")=="YES"
                                and importlib.util.find_spec("dawdreamer") is not None),
                "plugins": plugins,
                "explanation": "Installed bundles discovered, but native plugin DSP is NOT commissioned.",
            }
            self.wfile.write(json.dumps(body, sort_keys=True).encode())

        def do_POST(self):
            # This is executed only on owner-owned loopback and only with a
            # separately installed DawDreamer, opt-in flag and owner approval.
            if (self.path != "/v1/render" or
                    self.headers.get("Origin") != allowed_origin or
                    not hmac.compare_digest(self.headers.get("Authorization",""),
                                            "Bearer "+secret)):
                self._headers(403)
                self.wfile.write(b'{"error":"NOT_AUTHORIZED"}')
                return
            if (os.environ.get("MUSIC_DAW_NATIVE_RENDER_ENABLED") != "YES"
                    or importlib.util.find_spec("dawdreamer") is None):
                self._headers(503)
                self.wfile.write(b'{"error":"NATIVE_DSP_NOT_COMMISSIONED"}')
                return
            try:
                length=int(self.headers.get("Content-Length","-1"))
                if not 50<=length<=19*1024*1024:
                    raise ValueError("MUSIC_DAW_RENDER_INPUT_SIZE_INVALID")
                body=json.loads(self.rfile.read(length))
                if (body.get("ownerApproved") is not True or
                        not isinstance(body.get("pluginId"),str) or
                        not body["pluginId"].startswith("native-installed:") or
                        not isinstance(body.get("sourceSha256"),str) or
                        not isinstance(body.get("sourceWavBase64"),str)):
                    raise ValueError("MUSIC_DAW_RENDER_APPROVAL_OR_PLUGIN_INVALID")
                raw=base64.b64decode(body["sourceWavBase64"],validate=True)
                if (len(raw)>12*1024*1024 or len(raw)<44 or
                        raw[:4]!=b"RIFF" or raw[8:12]!=b"WAVE" or
                        hashlib.sha256(raw).hexdigest()!=body["sourceSha256"]):
                    raise ValueError("MUSIC_DAW_RENDER_SOURCE_MISMATCH")
                with tempfile.TemporaryDirectory(prefix="jhadina-native-fx-") as tmp:
                    source=Path(tmp)/"source.wav"
                    output=Path(tmp)/"output.wav"
                    source.write_bytes(raw)
                    result=subprocess.run([
                        sys.executable,str(Path(__file__).with_name("run_local_render_job.py")),
                        str(source),body["sourceSha256"],body["pluginId"],str(output)
                    ], capture_output=True, timeout=100, check=False)
                    if result.returncode!=0 or not output.is_file():
                        raise ValueError("MUSIC_DAW_NATIVE_RENDER_FAILED")
                    info=json.loads(result.stdout.decode("utf-8"))
                    sound=output.read_bytes()
                    if not 44<=len(sound)<=30*1024*1024:
                        raise ValueError("MUSIC_DAW_NATIVE_RENDER_SIZE_INVALID")
                    if hashlib.sha256(sound).hexdigest()!=info["outputSha256"]:
                        raise ValueError("MUSIC_DAW_NATIVE_RENDER_READBACK_MISMATCH")
                    payload={"success":True,"receipt":info,
                             "renderedWavBase64":base64.b64encode(sound).decode()}
                encoded=json.dumps(payload).encode()
                self._headers(200)
                self.wfile.write(encoded)
            except (ValueError,KeyError,TypeError,subprocess.TimeoutExpired) as exc:
                self._headers(422)
                self.wfile.write(b'{"error":"NATIVE_RENDER_BLOCKED_OR_FAILED"}')

        def log_message(self, format, *args):
            # No logging secret-bearing headers or client tokens.
            return

    return Handler


def main():
    secret = os.environ.get("MUSIC_DAW_COMPANION_TOKEN", "")
    origin = os.environ.get("MUSIC_DAW_ALLOWED_ORIGIN", "")
    HTTPServer(("127.0.0.1", PORT), create_handler(secret, origin)).serve_forever()


if __name__ == "__main__":
    main()
