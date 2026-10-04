from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import runpod


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_text(value: Any, code: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(code)
    return value.strip()


def callback(payload: dict[str, Any], status: str, **extra: Any) -> None:
    url = require_text(payload.get("callbackUrl"), "DIRECTOR_WATCH_CALLBACK_URL_REQUIRED")
    token = require_text(payload.get("callbackToken"), "DIRECTOR_WATCH_CALLBACK_TOKEN_REQUIRED")
    body = {"jobId": require_text(payload.get("jobId"), "DIRECTOR_WATCH_JOB_ID_REQUIRED"), "status": status, **extra}
    response = requests.post(
        url,
        headers={"authorization": f"Bearer {token}", "content-type": "application/json"},
        json=body,
        timeout=30,
    )
    response.raise_for_status()


def sample_frames(source: str, every_seconds: float, max_frames: int, output_dir: Path) -> list[Path]:
    pattern = str(output_dir / "frame-%06d.jpg")
    command = [
        "ffmpeg", "-nostdin", "-v", "error", "-y",
        "-i", source,
        "-vf", f"fps=1/{every_seconds:g}",
        "-frames:v", str(max_frames),
        "-q:v", "3",
        pattern,
    ]
    subprocess.run(command, check=True, timeout=max(180, int(every_seconds * max_frames * 3)))
    return sorted(output_dir.glob("frame-*.jpg"))


def image_data_url(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return "data:image/jpeg;base64," + encoded


def vlm_request(image_path: Path, prompt: str) -> dict[str, Any]:
    url = require_text(os.getenv("DIRECTOR_WATCH_VLM_URL"), "DIRECTOR_WATCH_VLM_URL_REQUIRED")
    model = require_text(os.getenv("DIRECTOR_WATCH_VLM_MODEL"), "DIRECTOR_WATCH_VLM_MODEL_REQUIRED")
    token = os.getenv("DIRECTOR_WATCH_VLM_TOKEN", "").strip()
    timeout = float(os.getenv("DIRECTOR_WATCH_REQUEST_TIMEOUT_SECONDS", "120"))
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    response = requests.post(
        url,
        headers=headers,
        json={
            "model": model,
            "temperature": 0.1,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_data_url(image_path)}},
                ],
            }],
        },
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()
    content = body["choices"][0]["message"]["content"]
    if not isinstance(content, str):
        raise RuntimeError("DIRECTOR_WATCH_VLM_CONTENT_INVALID")
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:].lstrip()
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("DIRECTOR_WATCH_VLM_JSON_INVALID")
    return parsed


def creative_prompt(timestamp_seconds: float) -> str:
    return f"""Analyze this authorized film/video frame at approximately {timestamp_seconds:.2f}s.
Return strict JSON only:
{{
  "observations": [
    {{
      "domain": "visual|story|editing|performance|writing|design|music",
      "technique": "short neutral technique label",
      "interpretation": "what is observably happening and a cautious possible creative effect; do not claim universal meaning",
      "confidence": 0.0,
      "measurement": {{}},
      "note": {{
        "kind": "general|shot|camera|edit|sound|lighting|performance|transition",
        "body": "concise cinematic notebook note",
        "tags": ["tag"]
      }}
    }}
  ]
}}
Use only what the frame supports. Do not identify private people. Do not imitate a named filmmaker or claim the source grants style rights."""


def sports_prompt(timestamp_seconds: float) -> str:
    return f"""Analyze this authorized sports frame at approximately {timestamp_seconds:.2f}s.
Return strict JSON only:
{{
  "observations": [
    {{
      "kind": "FORMATION|MATCHUP|TEMPO|FATIGUE|MOMENTUM|TACTICAL_ADJUSTMENT|PLAYER_ROLE|SUBSTITUTION|POSSESSION_CANDIDATE|SCORE_CANDIDATE|CLOCK_CANDIDATE|OTHER",
      "value": "brief observed or inferred value",
      "confidence": 0.0,
      "normalizedValue": 0.0
    }}
  ]
}}
This is visual inference only. Do not assert official score, clock, possession, identity, injury, or betting outcome without evidence visible in the frame. Candidate score/clock/possession/substitution observations require official reconciliation."""


def normalize_creative(raw: dict[str, Any], frame_index: int, timestamp_seconds: float) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for item_index, item in enumerate(raw.get("observations", [])):
        if not isinstance(item, dict):
            continue
        observation = {
            "id": f"frame:{frame_index}:creative:{item_index + 1}",
            "domain": item.get("domain"),
            "technique": item.get("technique"),
            "startMs": round(timestamp_seconds * 1000),
            "endMs": round(timestamp_seconds * 1000),
            "measurement": item.get("measurement") if isinstance(item.get("measurement"), dict) else None,
            "interpretation": item.get("interpretation"),
            "confidence": item.get("confidence"),
            "evidenceIds": [f"sampled-frame:{frame_index}", f"timestamp:{timestamp_seconds:.3f}"],
        }
        note = item.get("note")
        if isinstance(note, dict) and isinstance(note.get("body"), str) and note["body"].strip():
            observation["note"] = {
                "kind": note.get("kind", "general"),
                "body": note["body"].strip(),
                "tags": note.get("tags") if isinstance(note.get("tags"), list) else [],
                "startSeconds": timestamp_seconds,
                "endSeconds": timestamp_seconds,
            }
        output.append(observation)
    return output


def normalize_sports(raw: dict[str, Any], frame_index: int, timestamp_seconds: float) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    observed_at = now_iso()
    for item_index, item in enumerate(raw.get("observations", [])):
        if not isinstance(item, dict):
            continue
        output.append({
            "frameId": f"frame:{frame_index}",
            "kind": item.get("kind"),
            "value": item.get("value"),
            "confidence": item.get("confidence"),
            "normalizedValue": item.get("normalizedValue"),
            "observedAt": observed_at,
            "availableAt": observed_at,
            "methodologyVersion": "director-watch-vlm:v1",
            "evidenceIds": [
                f"sampled-frame:{frame_index}",
                f"timestamp:{timestamp_seconds:.3f}",
                f"vlm-observation:{item_index + 1}",
            ],
        })
    return output


def handler(job: dict[str, Any]) -> dict[str, Any]:
    payload = job.get("input") if isinstance(job, dict) else None
    if not isinstance(payload, dict):
        raise RuntimeError("DIRECTOR_WATCH_INPUT_REQUIRED")

    job_id = require_text(payload.get("jobId"), "DIRECTOR_WATCH_JOB_ID_REQUIRED")
    purpose = require_text(payload.get("purpose"), "DIRECTOR_WATCH_PURPOSE_REQUIRED")
    if purpose not in {"creative", "sports"}:
        raise RuntimeError("DIRECTOR_WATCH_PURPOSE_INVALID")
    if payload.get("rightsVerified") is not True or payload.get("sourceAuthorized") is not True:
        raise RuntimeError("DIRECTOR_WATCH_SOURCE_AUTHORIZATION_REQUIRED")

    source = require_text(payload.get("sourceLocator"), "DIRECTOR_WATCH_SOURCE_REQUIRED")
    every_seconds = float(payload.get("sampleEverySeconds", 2 if purpose == "sports" else 8))
    max_frames = int(payload.get("maxFrames", 180 if purpose == "sports" else 120))
    every_seconds = max(1.0, min(120.0, every_seconds))
    max_frames = max(1, min(600, max_frames))

    callback(payload, "running")
    try:
        with tempfile.TemporaryDirectory(prefix="jhadina-watch-") as temp:
            frames = sample_frames(source, every_seconds, max_frames, Path(temp))
            creative: list[dict[str, Any]] = []
            sports: list[dict[str, Any]] = []
            for index, frame in enumerate(frames, start=1):
                timestamp = (index - 1) * every_seconds
                raw = vlm_request(
                    frame,
                    creative_prompt(timestamp) if purpose == "creative" else sports_prompt(timestamp),
                )
                if purpose == "creative":
                    creative.extend(normalize_creative(raw, index, timestamp))
                else:
                    sports.extend(normalize_sports(raw, index, timestamp))

        completed: dict[str, Any] = {}
        if purpose == "creative":
            completed["creativeObservations"] = creative
        else:
            completed["sportsObservations"] = sports
        callback(payload, "completed", **completed)
        return {
            "ok": True,
            "jobId": job_id,
            "purpose": purpose,
            "frames": len(frames),
            "observations": len(creative) + len(sports),
            "authority": "OBSERVATION_ONLY" if purpose == "creative" else "DIRECTOR_INFERENCE_ONLY",
        }
    except Exception as exc:
        try:
            callback(payload, "failed", error=type(exc).__name__)
        finally:
            raise


runpod.serverless.start({"handler": handler})
