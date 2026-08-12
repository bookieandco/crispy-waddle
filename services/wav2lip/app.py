import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

APP = FastAPI(title="Jhadina Wav2Lip Runtime", version="1.0.0")
INPUT_DIR = Path(os.getenv("WAV2LIP_INPUT_DIR", "/data/inputs"))
OUTPUT_DIR = Path(os.getenv("WAV2LIP_OUTPUT_DIR", "/data/outputs"))
MODEL_PATH = Path(os.getenv("WAV2LIP_CHECKPOINT", "/models/wav2lip.pth"))
WAV2LIP_ROOT = Path(os.getenv("WAV2LIP_ROOT", "/opt/wav2lip/Wav2Lip"))
INFERENCE_SCRIPT = Path(os.getenv("WAV2LIP_INFERENCE_SCRIPT", str(WAV2LIP_ROOT / "inference.py")))
MAX_UPLOAD_BYTES = int(os.getenv("WAV2LIP_MAX_UPLOAD_BYTES", str(500 * 1024 * 1024)))

for directory in (INPUT_DIR, OUTPUT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def runtime_ready() -> tuple[bool, str]:
    if not MODEL_PATH.is_file():
        return False, "model checkpoint is missing"
    if not INFERENCE_SCRIPT.is_file():
        return False, "Wav2Lip inference.py is missing"
    return True, "ready"


def save_upload(upload: UploadFile, destination: Path) -> None:
    total = 0
    with destination.open("wb") as target:
        while chunk := upload.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                destination.unlink(missing_ok=True)
                raise HTTPException(413, "uploaded media exceeds the configured size limit")
            target.write(chunk)


def media_duration_seconds(path: Path) -> Optional[float]:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            check=True, capture_output=True, text=True, timeout=30,
        )
        return float(result.stdout.strip())
    except (subprocess.SubprocessError, ValueError):
        return None


@APP.get("/health")
def health() -> JSONResponse:
    ready, reason = runtime_ready()
    return JSONResponse({"status": "ready" if ready else "not_ready", "modelLoaded": ready, "reason": reason})


@APP.post("/v1/lipsync")
async def lipsync(
    video: UploadFile = File(...),
    audio: UploadFile = File(...),
    project_id: str = Form(...),
    face_det_batch_size: int = Form(16),
    wav2lip_batch_size: int = Form(128),
    resize_factor: int = Form(1),
) -> dict:
    ready, reason = runtime_ready()
    if not ready:
        raise HTTPException(503, f"Wav2Lip runtime not ready: {reason}")
    if not video.filename or not audio.filename:
        raise HTTPException(400, "video and audio files are required")
    if not project_id.strip():
        raise HTTPException(400, "project_id is required")
    if face_det_batch_size < 1 or wav2lip_batch_size < 1 or resize_factor < 1:
        raise HTTPException(400, "batch sizes and resize_factor must be positive")

    job_id = str(uuid.uuid4())
    video_path = INPUT_DIR / f"{job_id}-video{Path(video.filename).suffix or '.mp4'}"
    audio_path = INPUT_DIR / f"{job_id}-audio{Path(audio.filename).suffix or '.wav'}"
    output_path = OUTPUT_DIR / f"{job_id}.mp4"
    started = time.perf_counter()

    try:
        save_upload(video, video_path)
        save_upload(audio, audio_path)
        command = [
            "python3", str(INFERENCE_SCRIPT),
            "--checkpoint_path", str(MODEL_PATH),
            "--face", str(video_path),
            "--audio", str(audio_path),
            "--outfile", str(output_path),
            "--face_det_batch_size", str(face_det_batch_size),
            "--wav2lip_batch_size", str(wav2lip_batch_size),
            "--resize_factor", str(resize_factor),
        ]
        completed = subprocess.run(command, check=False, capture_output=True, text=True, timeout=int(os.getenv("WAV2LIP_JOB_TIMEOUT_SECONDS", "1800")))
        if completed.returncode != 0 or not output_path.is_file():
            raise HTTPException(502, "Wav2Lip inference failed")

        duration = media_duration_seconds(output_path)
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        # These are runtime measurements, not a claim of lip-sync accuracy. QC must calculate
        # alignment confidence from the generated media using its analyzer.
        return {
            "jobId": job_id,
            "projectId": project_id,
            "outputId": f"wav2lip:{job_id}",
            "outputPath": str(output_path),
            "provider": "wav2lip",
            "metrics": {
                "syncOffsetMs": None,
                "confidence": None,
                "durationMs": round(duration * 1000) if duration is not None else None,
                "runtimeMs": elapsed_ms,
            },
            "qc": {"required": True, "status": "pending"},
        }
    finally:
        video_path.unlink(missing_ok=True)
        audio_path.unlink(missing_ok=True)
