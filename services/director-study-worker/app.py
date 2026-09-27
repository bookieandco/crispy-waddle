from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

APP = FastAPI(title="Jhadina Director Study Worker", version="1.0.0")
ROOT = Path(os.getenv("DIRECTOR_WORKER_ROOT", "/tmp/director-worker"))
ROOT.mkdir(parents=True, exist_ok=True)
JOBS = ROOT / "jobs"
JOBS.mkdir(parents=True, exist_ok=True)

REFERENCE_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

KIND_RULES: list[tuple[str, tuple[str, ...], str, list[str], list[str], list[str]]] = [
    ("research", ("research", "niche", "market", "competitor", "analy", "audience"), "understand the source, market, or audience", ["research"], ["source-grounding"], ["weak evidence"]),
    ("character", ("character", "face", "identity", "reference image", "consistent face", "lora"), "establish or preserve character identity", ["character-reference", "visual-adapter"], ["identity-lock"], ["identity drift"]),
    ("wardrobe", ("outfit", "wardrobe", "clothes", "clothing", "shirt", "hoodie", "garment"), "control wardrobe and appearance continuity", ["wardrobe-state"], ["garment-lock"], ["garment drift"]),
    ("asset", ("dataset", "images", "photos", "crop", "caption", "tag", "curate", "duplicate"), "prepare or curate production/training assets", ["asset-curation"], ["dataset-quality"], ["duplicate or off-model assets"]),
    ("performance", ("pose", "motion", "movement", "perform", "blocking", "eyeline", "gesture", "lip sync", "lipsync"), "rehearse or control performance before final generation", ["performance-master", "rehearsal"], ["rehearsal-graduation"], ["collision or performance drift"]),
    ("voice", ("voice", "speech", "tts", "audio", "dialogue", "pronunciation"), "create or preserve voice/dialogue identity", ["voice-profile"], ["voice-identity"], ["voice drift"]),
    ("storyboard", ("storyboard", "shot list", "shotlist", "coverage", "camera angle"), "plan visual coverage before rendering", ["storyboard"], ["coverage-completeness"], ["missing coverage"]),
    ("generation", ("generate", "render", "inference", "sample", "checkpoint", "epoch", "train"), "produce candidate media or model outputs", ["generation"], ["candidate-qc"], ["artifact or overfit"]),
    ("edit", ("edit", "timeline", "cut", "transition", "assemble"), "assemble editable media into a coherent cut", ["timeline-editing"], ["edit-continuity"], ["timeline discontinuity"]),
    ("review", ("test", "compare", "inspect", "evaluate", "best", "quality", "check"), "review candidates and select admitted output", ["multimodal-review"], ["cross-domain-coherence"], ["weak selection evidence"]),
    ("delivery", ("export", "publish", "download", "deliver"), "package approved output and provenance", ["delivery"], ["export-integrity"], ["flattened or missing lineage"]),
]

PURPOSES = {kind: purpose for kind, _k, purpose, _c, _q, _f in KIND_RULES}


class StudyRequest(BaseModel):
    studyId: str
    sourceUrl: str
    callbackUrl: str
    replicationJobId: str
    contract: str


class VideoJobRequest(BaseModel):
    jobId: str
    projectId: str
    prompt: str
    intent: dict[str, Any]
    creativeName: str | None = None
    style: str | None = None
    scenes: list[dict[str, Any]] | None = None
    character: dict[str, Any] | None = None


def _token() -> str:
    return os.getenv("DIRECTOR_WORKER_TOKEN", "").strip()


def _auth(request: Request) -> None:
    expected = _token()
    header = request.headers.get("authorization", "")
    if not expected or not hmac.compare_digest(header, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="unauthorized")


def _callback_allowed(url: str) -> bool:
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}".lower()
    configured = [x.strip().lower() for x in os.getenv("DIRECTOR_CALLBACK_ORIGINS", "").split(",") if x.strip()]
    return bool(configured) and origin in configured


def _download_text(url: str) -> str:
    req = UrlRequest(url, headers={"User-Agent": "Mozilla/5.0 JhadinaDirector/1.0"})
    with urlopen(req, timeout=30) as response:
        raw = response.read(2_000_000)
        content_type = response.headers.get("content-type", "")
    text = raw.decode("utf-8", errors="ignore")
    if "html" in content_type.lower() or "<html" in text[:500].lower():
        text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
        text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _youtube_vtt(url: str) -> str:
    temp = Path(tempfile.mkdtemp(prefix="director-study-"))
    try:
        template = str(temp / "%(id)s.%(ext)s")
        cmd = [
            "yt-dlp", "--no-playlist", "--skip-download",
            "--write-subs", "--write-auto-subs",
            "--sub-langs", "en.*,en", "--sub-format", "vtt",
            "-o", template, url,
        ]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        candidates = sorted(temp.glob("*.vtt"))
        if not candidates:
            raise RuntimeError(f"yt-dlp subtitles unavailable: {proc.stderr[-500:]}")
        return candidates[0].read_text("utf-8", errors="ignore")
    finally:
        shutil.rmtree(temp, ignore_errors=True)


def _parse_vtt(vtt: str) -> list[dict[str, Any]]:
    cues: list[dict[str, Any]] = []
    lines = vtt.splitlines()
    i = 0
    ts = re.compile(r"(?P<h>\d\d):(?P<m>\d\d):(?P<s>\d\d(?:\.\d+)?)\s+-->\s+(?P<h2>\d\d):(?P<m2>\d\d):(?P<s2>\d\d(?:\.\d+)?)")
    while i < len(lines):
        match = ts.search(lines[i])
        if not match:
            i += 1
            continue
        def sec(h: str, m: str, s: str) -> float:
            return int(h) * 3600 + int(m) * 60 + float(s)
        start = sec(match.group("h"), match.group("m"), match.group("s"))
        end = sec(match.group("h2"), match.group("m2"), match.group("s2"))
        i += 1
        buff: list[str] = []
        while i < len(lines) and lines[i].strip():
            line = re.sub(r"<[^>]+>", "", lines[i]).strip()
            if line and not line.startswith("NOTE"):
                buff.append(line)
            i += 1
        text = re.sub(r"\s+", " ", " ".join(buff)).strip()
        if text:
            cues.append({"start": start, "end": max(end, start + 0.5), "text": text})
        i += 1
    deduped: list[dict[str, Any]] = []
    last = ""
    for cue in cues:
        if cue["text"] == last:
            continue
        deduped.append(cue)
        last = cue["text"]
    return deduped


def _plain_segments(text: str) -> list[dict[str, Any]]:
    chunks = [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n{2,}", text) if len(x.strip()) >= 20]
    result: list[dict[str, Any]] = []
    cursor = 0.0
    for chunk in chunks[:200]:
        duration = max(5.0, min(30.0, len(chunk) / 12.0))
        result.append({"start": cursor, "end": cursor + duration, "text": chunk})
        cursor += duration
    return result


def _classify(text: str) -> tuple[str, str, list[str], list[str], list[str]]:
    low = text.lower()
    for kind, keywords, purpose, caps, qc, failures in KIND_RULES:
        if any(keyword in low for keyword in keywords):
            return kind, purpose, list(caps), list(qc), list(failures)
    return "concept", "capture the source concept or instruction", ["process-understanding"], ["source-grounding"], ["ambiguous instruction"]


def _steps(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: list[dict[str, Any]] = []
    for seg in segments:
        kind, purpose, caps, qc, failures = _classify(seg["text"])
        text = seg["text"][:900]
        if grouped and grouped[-1]["kind"] == kind and seg["start"] - grouped[-1]["end"] < 20:
            grouped[-1]["end"] = seg["end"]
            grouped[-1]["text"] = (grouped[-1]["text"] + " " + text)[:1400]
        else:
            grouped.append({"kind": kind, "purpose": purpose, "caps": caps, "qc": qc, "failures": failures, "start": seg["start"], "end": seg["end"], "text": text})
    selected = grouped[:24]
    kinds = {row["kind"] for row in selected}
    if "performance" not in kinds:
        for row in grouped:
            if re.search(r"pose|motion|movement|animate|lip sync|gesture", row["text"], flags=re.I):
                row = dict(row)
                row["kind"] = "performance"
                row["purpose"] = PURPOSES["performance"]
                row["caps"] = ["performance-master", "rehearsal"]
                row["qc"] = ["rehearsal-graduation"]
                row["failures"] = ["collision or performance drift"]
                selected.append(row)
                break
    if len(selected) < 4:
        selected = grouped[: min(8, len(grouped))]
    observations: list[dict[str, Any]] = []
    for idx, row in enumerate(selected):
        digest = hashlib.sha256(f"{idx}|{row['start']}|{row['text']}".encode()).hexdigest()[:16]
        observations.append({
            "id": f"study-step:{digest}",
            "kind": "process-step",
            "time": {"startSeconds": round(row["start"], 3), "endSeconds": round(row["end"], 3)},
            "confidence": 0.82,
            "provenance": {"provider": "director-study-worker", "source": "reference-media"},
            "payload": {
                "processStep": {
                    "order": idx,
                    "kind": row["kind"],
                    "purpose": row["purpose"],
                    "operation": row["text"],
                    "requiredCapabilities": row["caps"],
                    "inputs": [f"source-step:{max(0, idx-1)}"] if idx else ["source-reference"],
                    "outputs": [f"source-step:{idx}"],
                    "qcChecks": row["qc"],
                    "failureModes": row["failures"],
                }
            },
        })
    return observations


def _study_source(url: str) -> list[dict[str, Any]]:
    host = urlparse(url).netloc.lower()
    if "youtube.com" in host or "youtu.be" in host:
        try:
            return _steps(_parse_vtt(_youtube_vtt(url)))
        except Exception:
            pass
    return _steps(_plain_segments(_download_text(url)))


def _callback(url: str, payload: dict[str, Any]) -> None:
    if not _callback_allowed(url):
        raise RuntimeError("callback origin not allowed")
    body = json.dumps(payload).encode()
    req = UrlRequest(
        url,
        data=body,
        headers={"content-type": "application/json", "authorization": f"Bearer {_token()}"},
        method="POST",
    )
    with urlopen(req, timeout=90) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"callback failed: {response.status}")


def _job_dir(job_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", job_id)
    path = JOBS / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def _state_path(job_id: str) -> Path:
    return _job_dir(job_id) / "state.json"


def _read_state(job_id: str) -> dict[str, Any] | None:
    path = _state_path(job_id)
    if not path.exists():
        return None
    return json.loads(path.read_text("utf-8"))


def _write_state(job_id: str, state: dict[str, Any]) -> None:
    path = _state_path(job_id)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state), "utf-8")
    temp.replace(path)


def _render(job_id: str, duration: int, prompt: str) -> None:
    state = _read_state(job_id) or {}
    output = _job_dir(job_id) / "output.mp4"
    started = time.time()
    try:
        _write_state(job_id, {**state, "status": "processing", "startedAt": started})
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", f"color=c=0x111827:s=320x180:r=1:d={duration}",
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
            "-crf", "43", "-pix_fmt", "yuv420p", "-r", "1",
            "-movflags", "+faststart",
            "-metadata", "title=Jhadina Director live certification smoke render",
            "-metadata", f"comment={prompt[:200]}",
            str(output),
        ]
        subprocess.run(cmd, check=True, timeout=max(120, min(900, duration // 3 + 120)))
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", str(output)],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30,
        )
        measured = float(probe.stdout.strip())
        sha = hashlib.sha256(output.read_bytes()).hexdigest()
        _write_state(job_id, {
            **state,
            "status": "ready",
            "requestedDurationSeconds": duration,
            "durationSeconds": measured,
            "bytes": output.stat().st_size,
            "sha256": sha,
            "renderer": "ffmpeg-runtime-smoke",
            "qualityClaim": "runtime-certification-only",
            "completedAt": time.time(),
        })
    except Exception as exc:
        _write_state(job_id, {**state, "status": "failed", "error": str(exc), "completedAt": time.time()})


@APP.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": bool(shutil.which("ffmpeg") and shutil.which("ffprobe") and shutil.which("yt-dlp")),
        "service": "director-study-worker",
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "ffprobe": bool(shutil.which("ffprobe")),
        "ytDlp": bool(shutil.which("yt-dlp")),
    }


@APP.post("/study")
def study(body: StudyRequest, request: Request) -> dict[str, Any]:
    _auth(request)
    if body.contract != "DIRECTOR_STUDY_WORKER_V1":
        raise HTTPException(status_code=400, detail="unsupported contract")
    observations = _study_source(body.sourceUrl)
    if not observations:
        raise HTTPException(status_code=422, detail="no process observations")
    for obs in observations:
        obs["assetId"] = body.studyId
        obs["provenance"]["sourceUrl"] = body.sourceUrl
    _callback(body.callbackUrl, {
        "studyId": body.studyId,
        "replicationJobId": body.replicationJobId,
        "status": "completed",
        "observations": observations,
    })
    return {"ok": True, "studyId": body.studyId, "observationCount": len(observations)}


@APP.get("/cert/reference.png")
def reference_png() -> Response:
    return Response(content=REFERENCE_PNG, media_type="image/png", headers={"cache-control": "public, max-age=31536000, immutable"})


@APP.post("/jobs")
def create_video_job(body: VideoJobRequest, request: Request) -> dict[str, Any]:
    _auth(request)
    raw_duration = body.intent.get("targetDurationSeconds", 30)
    try:
        duration = int(round(float(raw_duration)))
    except Exception:
        duration = 30
    duration = max(1, min(3600, duration))
    idem = request.headers.get("idempotency-key", "")
    job_id = hashlib.sha256(f"{idem}|{body.jobId}|{duration}".encode()).hexdigest()[:24]
    state = _read_state(job_id)
    if state is None:
        _write_state(job_id, {
            "status": "queued",
            "requestedDurationSeconds": duration,
            "projectId": body.projectId,
            "sourceJobId": body.jobId,
        })
        thread = threading.Thread(target=_render, args=(job_id, duration, body.prompt), daemon=True)
        thread.start()
        status = "queued"
    else:
        status = state.get("status", "queued")
    return {"providerJobId": job_id, "status": status, "metadata": {"requestedDurationSeconds": duration, "certification": True}}


@APP.get("/jobs/{job_id}")
def video_job_status(job_id: str, request: Request) -> dict[str, Any]:
    _auth(request)
    state = _read_state(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="job not found")
    payload = {
        "providerJobId": job_id,
        "status": state.get("status", "processing"),
        "metadata": {k: v for k, v in state.items() if k not in {"status", "error"}},
    }
    if state.get("status") == "ready":
        payload["resultUri"] = f"/jobs/{job_id}/output"
    if state.get("error"):
        payload["error"] = state["error"]
    return payload


@APP.get("/jobs/{job_id}/output")
def video_job_output(job_id: str, request: Request) -> FileResponse:
    _auth(request)
    state = _read_state(job_id)
    output = _job_dir(job_id) / "output.mp4"
    if not state or state.get("status") != "ready" or not output.exists():
        raise HTTPException(status_code=409, detail="output not ready")
    return FileResponse(output, media_type="video/mp4", filename=f"{job_id}.mp4")


@APP.delete("/jobs/{job_id}")
def cancel_video_job(job_id: str, request: Request) -> dict[str, Any]:
    _auth(request)
    state = _read_state(job_id)
    if not state:
        return {"ok": True, "cancelled": False}
    _write_state(job_id, {**state, "status": "failed", "error": "cancelled"})
    return {"ok": True, "cancelled": True}
