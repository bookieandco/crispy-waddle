from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

from edge_prefilter import select_frames
from handler import (
    callback,
    creative_prompt,
    evenly_spaced_frame_indices,
    normalize_creative,
    normalize_sports,
    normalize_take_qc,
    normalize_take_qc_temporal,
    require_text,
    sports_prompt,
    take_qc_prompt,
    take_qc_temporal_prompt,
    vlm_request,
    vlm_request_images,
)


def media_roots() -> list[Path]:
    raw = os.getenv(
        "DIRECTOR_WATCH_HOMEBASE_MEDIA_ROOTS",
        "/media,/mnt/media,/srv/media",
    )
    roots: list[Path] = []
    for item in raw.split(","):
        clean = item.strip()
        if not clean:
            continue
        roots.append(Path(clean).expanduser().resolve())
    if not roots:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_MEDIA_ROOT_REQUIRED")
    return roots


def validate_local_file(value: str) -> Path:
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_LOCAL_FILE_ABSOLUTE_REQUIRED")
    resolved = candidate.resolve(strict=True)
    if not resolved.is_file():
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_LOCAL_FILE_REQUIRED")
    allowed = any(resolved == root or root in resolved.parents for root in media_roots())
    if not allowed:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_LOCAL_FILE_OUTSIDE_MEDIA_ROOT")
    return resolved


def rtsp_allowlist() -> set[str]:
    raw = os.getenv("DIRECTOR_WATCH_HOMEBASE_RTSP_ALLOWLIST", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def validate_rtsp(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme.lower() not in {"rtsp", "rtsps"} or not parsed.hostname:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_RTSP_URL_INVALID")
    if parsed.username or parsed.password:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_RTSP_INLINE_CREDENTIALS_FORBIDDEN")
    host = parsed.hostname.lower()
    allowed = rtsp_allowlist()
    if not allowed or host not in allowed:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_RTSP_HOST_NOT_ALLOWED")
    return value


def capture_sources() -> dict[str, dict[str, Any]]:
    raw = os.getenv("DIRECTOR_WATCH_HOMEBASE_CAPTURE_SOURCES", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_CONFIG_INVALID") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_CONFIG_INVALID")
    result: dict[str, dict[str, Any]] = {}
    for alias, spec in parsed.items():
        if not isinstance(alias, str) or not alias.strip() or not isinstance(spec, dict):
            raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_CONFIG_INVALID")
        result[alias.strip()] = spec
    return result


def capture_command(alias: str, every_seconds: float, max_frames: int, output_dir: Path) -> list[str]:
    spec = capture_sources().get(alias)
    if not spec:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_ALIAS_NOT_FOUND")
    kind = str(spec.get("kind", "")).strip().lower()
    pattern = str(output_dir / "frame-%06d.jpg")
    base = ["ffmpeg", "-nostdin", "-v", "error", "-y"]

    if kind == "v4l2":
        device = str(spec.get("device", "")).strip()
        if not device.startswith("/dev/video") or not device[len("/dev/video"):].isdigit():
            raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_DEVICE_INVALID")
        base += ["-f", "v4l2", "-i", device]
    elif kind == "avfoundation":
        device = str(spec.get("device", "")).strip()
        if not device or any(ch not in "0123456789:" for ch in device):
            raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_DEVICE_INVALID")
        base += ["-f", "avfoundation", "-i", device]
    elif kind == "decklink":
        device = str(spec.get("device", "")).strip()
        allowed = {
            item.strip()
            for item in os.getenv("DIRECTOR_WATCH_HOMEBASE_DECKLINK_ALLOWLIST", "").split(",")
            if item.strip()
        }
        if not device or device not in allowed:
            raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_DECKLINK_DEVICE_NOT_ALLOWED")
        base += ["-f", "decklink", "-i", device]
    else:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_CAPTURE_KIND_INVALID")

    base += [
        "-vf", f"fps=1/{every_seconds:g}",
        "-frames:v", str(max_frames),
        "-q:v", "3",
        pattern,
    ]
    return base


def sample_homebase_frames(
    source_kind: str,
    source_locator: str,
    every_seconds: float,
    max_frames: int,
    output_dir: Path,
) -> list[Path]:
    pattern = str(output_dir / "frame-%06d.jpg")
    if source_kind == "local-file":
        source = str(validate_local_file(source_locator))
        command = [
            "ffmpeg", "-nostdin", "-v", "error", "-y",
            "-i", source,
            "-vf", f"fps=1/{every_seconds:g}",
            "-frames:v", str(max_frames),
            "-q:v", "3",
            pattern,
        ]
    elif source_kind == "rtsp":
        source = validate_rtsp(source_locator)
        command = [
            "ffmpeg", "-nostdin", "-v", "error", "-y",
            "-rtsp_transport", "tcp",
            "-i", source,
            "-vf", f"fps=1/{every_seconds:g}",
            "-frames:v", str(max_frames),
            "-q:v", "3",
            pattern,
        ]
    elif source_kind in {"capture", "homebase-capture"}:
        command = capture_command(source_locator, every_seconds, max_frames, output_dir)
    else:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_SOURCE_KIND_INVALID")

    timeout = max(180, int(every_seconds * max_frames * 3))
    subprocess.run(command, check=True, timeout=timeout)
    frames = sorted(output_dir.glob("frame-*.jpg"))
    if not frames:
        raise RuntimeError("DIRECTOR_WATCH_HOMEBASE_NO_FRAMES")
    return frames


def handler(job: dict[str, Any]) -> dict[str, Any]:
    payload = job.get("input") if isinstance(job, dict) else None
    if not isinstance(payload, dict):
        raise RuntimeError("DIRECTOR_WATCH_INPUT_REQUIRED")

    job_id = require_text(payload.get("jobId"), "DIRECTOR_WATCH_JOB_ID_REQUIRED")
    purpose = require_text(payload.get("purpose"), "DIRECTOR_WATCH_PURPOSE_REQUIRED")
    if purpose not in {"creative", "sports", "take-qc"}:
        raise RuntimeError("DIRECTOR_WATCH_PURPOSE_INVALID")
    if payload.get("rightsVerified") is not True or payload.get("sourceAuthorized") is not True:
        raise RuntimeError("DIRECTOR_WATCH_SOURCE_AUTHORIZATION_REQUIRED")

    source_kind = require_text(payload.get("sourceKind"), "DIRECTOR_WATCH_SOURCE_KIND_REQUIRED")
    source_locator = require_text(payload.get("sourceLocator"), "DIRECTOR_WATCH_SOURCE_REQUIRED")
    default_every = 2 if purpose == "sports" else 1.5 if purpose == "take-qc" else 8
    default_frames = 180 if purpose == "sports" else 24 if purpose == "take-qc" else 120
    every_seconds = max(1.0, min(120.0, float(payload.get("sampleEverySeconds", default_every))))
    max_frames = max(1, min(600, int(payload.get("maxFrames", default_frames))))

    callback(payload, "running")
    try:
        with tempfile.TemporaryDirectory(prefix="jhadina-watch-homebase-") as temp:
            frames = sample_homebase_frames(
                source_kind, source_locator, every_seconds, max_frames, Path(temp)
            )
            sampled_frame_count = len(frames)
            prefilter_summary: dict[str, Any] | None = None
            selected_frame_indices = list(range(1, len(frames) + 1))
            frames_for_vlm = frames

            edge_prefilter_enabled = (
                purpose in {"creative", "sports"}
                and (
                    payload.get("edgePrefilterEnabled") is True
                    or (
                        payload.get("edgePrefilterEnabled") is not False
                        and payload.get("background") is True
                    )
                )
            )
            if edge_prefilter_enabled:
                policy = payload.get("edgePrefilter")
                if policy is not None and not isinstance(policy, dict):
                    raise RuntimeError("DIRECTOR_WATCH_EDGE_PREFILTER_INVALID")
                frames_for_vlm, prefilter_summary = select_frames(
                    frames,
                    every_seconds,
                    purpose,
                    policy,
                )
                selected_frame_indices = [
                    int(value)
                    for value in prefilter_summary.get("selectedFrameIndices", [])
                    if isinstance(value, int) or (isinstance(value, str) and value.isdigit())
                ]

            creative: list[dict[str, Any]] = []
            sports: list[dict[str, Any]] = []
            take_qc: list[dict[str, Any]] = []

            for selection_offset, frame in enumerate(frames_for_vlm):
                original_index = (
                    selected_frame_indices[selection_offset]
                    if selection_offset < len(selected_frame_indices)
                    else selection_offset + 1
                )
                index = original_index
                timestamp = (original_index - 1) * every_seconds
                prompt = (
                    creative_prompt(timestamp)
                    if purpose == "creative"
                    else sports_prompt(timestamp)
                    if purpose == "sports"
                    else take_qc_prompt(timestamp, str(payload.get("qcContext", "")))
                )
                raw = vlm_request(frame, prompt)
                if purpose == "creative":
                    creative.extend(normalize_creative(raw, index, timestamp))
                elif purpose == "sports":
                    sports.extend(normalize_sports(raw, index, timestamp))
                else:
                    take_qc.extend(normalize_take_qc(raw, index, timestamp))

            if purpose == "take-qc" and len(frames) >= 2:
                selected_indices = evenly_spaced_frame_indices(len(frames), 6)
                temporal_paths = [frames[index] for index in selected_indices]
                temporal_timestamps = [index * every_seconds for index in selected_indices]
                temporal_raw = vlm_request_images(
                    temporal_paths,
                    take_qc_temporal_prompt(
                        str(payload.get("qcContext", "")), len(temporal_paths)
                    ),
                )
                take_qc.extend(
                    normalize_take_qc_temporal(
                        temporal_raw,
                        [index + 1 for index in selected_indices],
                        temporal_timestamps,
                    )
                )

        completed: dict[str, Any] = {}
        if prefilter_summary is not None:
            completed["edgePrefilter"] = prefilter_summary
        if purpose == "creative":
            completed["creativeObservations"] = creative
        elif purpose == "sports":
            completed["sportsObservations"] = sports
        else:
            completed["takeQcEvidence"] = take_qc
        callback(payload, "completed", **completed)
        return {
            "ok": True,
            "jobId": job_id,
            "purpose": purpose,
            "frames": len(frames_for_vlm) if purpose in {"creative", "sports"} else len(frames),
            "sampledFrames": sampled_frame_count,
            "edgePrefilter": prefilter_summary,
            "observations": len(creative) + len(sports) + len(take_qc),
            "sourceAuthority": "OWNER_CONFIGURED_HOMEBASE_SOURCE",
            "authority": (
                "OBSERVATION_ONLY"
                if purpose == "creative"
                else "DIRECTOR_INFERENCE_ONLY"
                if purpose == "sports"
                else "DIRECTOR_TAKE_QC_EVIDENCE_ONLY"
            ),
        }
    except Exception as exc:
        try:
            callback(payload, "failed", error=type(exc).__name__)
        finally:
            raise


if __name__ == "__main__":
    import runpod
    runpod.serverless.start({"handler": handler})
