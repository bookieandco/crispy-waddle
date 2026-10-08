"""Local-only companion scanner. Read-only plugin inventory, NO VST execution.

Example laptop:
MUSIC_DAW_COMPANION_TOKEN=<random long secret> \
MUSIC_DAW_ALLOWED_ORIGIN=https://your-jhadina-app.example \
python3 services/music-daw-companion/local_discovery.py
Do not paste your token into ChatGPT or expose this listener on any network.
"""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, HTTPServer
import hmac
import json
import os

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
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Type", "application/json")
            self.end_headers()

        def do_OPTIONS(self):
            if self.path != "/v1/plugins" or self.headers.get("Origin") != allowed_origin:
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
                "hostConnected": True, "renderReady": False,
                "nativeAudioExecutionAvailable": False,
                "plugins": plugins,
                "explanation": "Installed bundles discovered, but native plugin DSP is NOT commissioned.",
            }
            self.wfile.write(json.dumps(body, sort_keys=True).encode())

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
