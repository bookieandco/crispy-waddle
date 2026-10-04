from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
import requests


def _clamp01(value: float) -> float:
    if not np.isfinite(value):
        return 0.0
    return float(max(0.0, min(1.0, value)))


def _gray_thumbnail(path: Path, width: int = 96, height: int = 54) -> np.ndarray:
    with Image.open(path) as image:
        gray = image.convert("L").resize((width, height))
        return np.asarray(gray, dtype=np.float32) / 255.0


def motion_scores(frames: list[Path]) -> list[float]:
    if not frames:
        return []
    scores = [1.0]
    previous = _gray_thumbnail(frames[0])
    for frame in frames[1:]:
        current = _gray_thumbnail(frame)
        score = float(np.mean(np.abs(current - previous)))
        scores.append(_clamp01(score * 3.0))
        previous = current
    return scores


def _detector_config() -> tuple[str, str] | None:
    url = os.getenv("DIRECTOR_WATCH_EDGE_DETECTOR_URL", "").strip()
    token = os.getenv("DIRECTOR_WATCH_EDGE_DETECTOR_TOKEN", "").strip()
    if not url:
        return None
    if not url.startswith("https://"):
        raise RuntimeError("DIRECTOR_WATCH_EDGE_DETECTOR_HTTPS_REQUIRED")
    return url, token


def detector_signal(path: Path) -> dict[str, Any]:
    config = _detector_config()
    if not config:
        return {"detectionCount": 0, "detectionClasses": [], "confidence": 0.0}
    url, token = config
    headers: dict[str, str] = {"accept": "application/json"}
    if token:
        headers["authorization"] = "Bearer " + token
    with path.open("rb") as handle:
        response = requests.post(
            url,
            headers=headers,
            files={"file": (path.name, handle, "image/jpeg")},
            timeout=float(os.getenv("DIRECTOR_WATCH_EDGE_DETECTOR_TIMEOUT_SECONDS", "15")),
        )
    response.raise_for_status()
    body = response.json()
    detections = body.get("detections") if isinstance(body, dict) else None
    rows = detections if isinstance(detections, list) else []
    classes: list[str] = []
    confidences: list[float] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = str(row.get("className") or row.get("class") or row.get("label") or "").strip()
        confidence = row.get("confidence")
        if label:
            classes.append(label)
        if isinstance(confidence, (int, float)) and np.isfinite(confidence):
            confidences.append(_clamp01(float(confidence)))
    return {
        "detectionCount": len(rows),
        "detectionClasses": sorted(set(classes)),
        "confidence": max(confidences, default=0.0),
    }


def default_policy(purpose: str) -> dict[str, Any]:
    if purpose == "sports":
        return {
            "mode": "hybrid",
            "minimumMotionScore": 0.05,
            "minimumDetectionConfidence": 0.30,
            "interestingClasses": ["person", "sports ball", "baseball bat", "baseball glove", "tennis racket"],
            "keepEverySeconds": 10.0,
            "maximumEscalatedFrames": 90,
            "preserveFirstLast": True,
        }
    return {
        "mode": "motion",
        "minimumMotionScore": 0.08,
        "minimumDetectionConfidence": 0.35,
        "interestingClasses": [],
        "keepEverySeconds": 30.0,
        "maximumEscalatedFrames": 48,
        "preserveFirstLast": True,
    }


def select_frames(
    frames: list[Path],
    every_seconds: float,
    purpose: str,
    policy: dict[str, Any] | None = None,
) -> tuple[list[Path], dict[str, Any]]:
    if not frames:
        return [], {
            "selectedFrameIndices": [],
            "droppedFrameIndices": [],
            "selectedRatio": 0.0,
            "signals": [],
            "authority": "EDGE_PREFILTER_ONLY",
        }

    resolved = {**default_policy(purpose), **(policy or {})}
    mode = str(resolved.get("mode", "disabled")).strip().lower()
    minimum_motion = _clamp01(float(resolved.get("minimumMotionScore", 0.08)))
    minimum_detection = _clamp01(float(resolved.get("minimumDetectionConfidence", 0.35)))
    keep_every = max(1.0, float(resolved.get("keepEverySeconds", 30.0)))
    cap = max(1, min(len(frames), int(resolved.get("maximumEscalatedFrames", len(frames)))))
    preserve_first_last = bool(resolved.get("preserveFirstLast", True))
    interesting = {
        str(value).strip().lower()
        for value in resolved.get("interestingClasses", [])
        if str(value).strip()
    }

    motion = motion_scores(frames) if mode in {"motion", "hybrid"} else [0.0] * len(frames)
    use_detector = mode in {"object-detection", "hybrid"} and _detector_config() is not None
    signals: list[dict[str, Any]] = []
    candidates: list[tuple[float, int, list[str]]] = []
    last_baseline = float("-inf")

    for offset, frame in enumerate(frames):
        frame_index = offset + 1
        timestamp = offset * every_seconds
        reasons: list[str] = []
        score = 0.0
        detector = detector_signal(frame) if use_detector else {
            "detectionCount": 0,
            "detectionClasses": [],
            "confidence": 0.0,
        }

        if mode == "disabled":
            reasons.append("PREFILTER_DISABLED")
            score = 1.0
        if mode in {"motion", "hybrid"} and motion[offset] >= minimum_motion:
            reasons.append("MOTION_THRESHOLD")
            score = max(score, motion[offset])

        classes = [str(value).strip().lower() for value in detector["detectionClasses"]]
        class_hit = any(value in interesting for value in classes)
        detection_hit = (
            int(detector["detectionCount"]) > 0
            and float(detector["confidence"]) >= minimum_detection
            and (not interesting or class_hit)
        )
        if mode in {"object-detection", "hybrid"} and detection_hit:
            reasons.append("INTERESTING_CLASS" if class_hit else "OBJECT_DETECTION")
            score = max(score, float(detector["confidence"]))

        if preserve_first_last and offset == 0:
            reasons.append("PRESERVE_FIRST")
            score = max(score, 1.0)
        if preserve_first_last and offset == len(frames) - 1:
            reasons.append("PRESERVE_LAST")
            score = max(score, 1.0)
        if timestamp - last_baseline >= keep_every:
            reasons.append("PERIODIC_BASELINE")
            score = max(score, 0.75)
            last_baseline = timestamp

        signals.append({
            "frameIndex": frame_index,
            "timestampSeconds": timestamp,
            "motionScore": motion[offset],
            **detector,
            "reasons": reasons,
            "score": score,
        })
        if score > 0:
            candidates.append((score, frame_index, reasons))

    selected_indices = {
        frame_index
        for _, frame_index, _ in sorted(candidates, key=lambda item: (-item[0], item[1]))[:cap]
    }
    selected = [frame for index, frame in enumerate(frames, start=1) if index in selected_indices]
    dropped = [index for index in range(1, len(frames) + 1) if index not in selected_indices]

    return selected, {
        "mode": mode,
        "selectedFrameIndices": sorted(selected_indices),
        "droppedFrameIndices": dropped,
        "selectedRatio": len(selected) / len(frames),
        "signals": signals,
        "detectorConfigured": use_detector,
        "authority": "EDGE_PREFILTER_ONLY",
        "canEstablishReality": False,
        "canPublish": False,
        "canWager": False,
    }
