"""Trusted, offline source-duration probe for Director Recast.

This module is NOT an HTTP endpoint or a model/worker launcher. A privileged
asset resolver supplies an already-admitted local file and its SHA-256.
No network URLs, shell interpolation, arbitrary asset paths or signed URLs.
"""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path
from typing import Any, Callable

MAX_SOURCE_BYTES = 300 * 1024 * 1024

def _hash_file(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(part)
    return sha.hexdigest()

def _duration_and_dimensions(payload: Any) -> tuple[float, int, int, bool]:
    if not isinstance(payload, dict):
        raise ValueError("DIRECTOR_RECAST_FFPROBE_RESPONSE_INVALID")
    details = payload.get("format", {})
    streams = payload.get("streams", [])
    if not isinstance(details, dict) or not isinstance(streams, list):
        raise ValueError("DIRECTOR_RECAST_FFPROBE_RESPONSE_INVALID")
    try:
        duration = float(details.get("duration"))
    except (TypeError, ValueError) as error:
        raise ValueError("DIRECTOR_RECAST_FFPROBE_DURATION_INVALID") from error
    if not math.isfinite(duration) or duration <= 0 or duration > 30:
        raise ValueError("DIRECTOR_RECAST_FFPROBE_DURATION_OUT_OF_SCOPE")
    videos = [v for v in streams if isinstance(v, dict) and v.get("codec_type") == "video"]
    if not videos:
        raise ValueError("DIRECTOR_RECAST_FFPROBE_VIDEO_STREAM_REQUIRED")
    width, height = videos[0].get("width"), videos[0].get("height")
    if not isinstance(width, int) or isinstance(width, bool) or \
       not isinstance(height, int) or isinstance(height, bool) or \
       width < 32 or height < 32:
        raise ValueError("DIRECTOR_RECAST_FFPROBE_DIMENSIONS_INVALID")
    audio_present = any(isinstance(s, dict) and s.get("codec_type") == "audio" for s in streams)
    return duration, width, height, audio_present

def probe_local_recast_source(
    *,
    admitted_media_root: str,
    local_source_path: str,
    project_id: str,
    source_asset_id: str,
    expected_sha256: str,
    runner: Callable[..., Any] = subprocess.run,
) -> dict[str, Any]:
    if not project_id.strip() or not source_asset_id.strip() or \
       len(expected_sha256) != 64 or \
       any(c not in "0123456789abcdefABCDEF" for c in expected_sha256):
        raise ValueError("DIRECTOR_RECAST_FFPROBE_ADMISSION_REQUIRED")
    base = Path(admitted_media_root).resolve(strict=True)
    path = Path(local_source_path).resolve(strict=True)
    if not path.is_relative_to(base) or not path.is_file():
        raise ValueError("DIRECTOR_RECAST_FFPROBE_PATH_NOT_ADMITTED")
    if not 0 < path.stat().st_size <= MAX_SOURCE_BYTES:
        raise ValueError("DIRECTOR_RECAST_FFPROBE_SOURCE_SIZE_INVALID")
    actual_sha256 = _hash_file(path)
    if actual_sha256.lower() != expected_sha256.lower():
        raise ValueError("DIRECTOR_RECAST_FFPROBE_SOURCE_HASH_MISMATCH")
    # The command takes a local path only, with no shell, network protocol
    # or variable command-line arguments supplied by a browser.
    argv = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration:stream=codec_type,width,height",
        "-of", "json", str(path),
    ]
    completed = runner(argv, check=False, capture_output=True, text=True, timeout=15)
    if completed.returncode != 0 or not isinstance(completed.stdout, str):
        raise ValueError("DIRECTOR_RECAST_FFPROBE_DECODER_FAILED")
    try:
        decoded = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise ValueError("DIRECTOR_RECAST_FFPROBE_RESPONSE_INVALID") from error
    duration, width, height, audio_present = _duration_and_dimensions(decoded)
    report: dict[str, Any] = {
        "projectId": project_id,
        "sourceVideoAssetId": source_asset_id,
        "sourceVideoSha256": actual_sha256,
        "durationSeconds": duration,
        "hasVideoStream": True,
        "hasAudioStream": audio_present,
        "frameWidth": width,
        "frameHeight": height,
        "probeVersion": "recast-ffprobe-v1",
        "measuredBy": "trusted-local-media-probe",
    }
    report["evidenceSha256"] = hashlib.sha256(
        json.dumps(report, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    # Caller must commit a separately authorized, immutable receipt.
    # A dict is not itself a durable review, execution permit or approval.
    return report
