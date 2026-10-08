"""Optional, evidence-bound drum sub-stem inference.

Runs only on locally staged, hash-verified parents after the existing worker
authentication boundary. No generic shell commands, user-supplied model paths
or invented vocal ad-lib stems are admitted.
"""
from __future__ import annotations

from hashlib import sha256
from importlib import metadata
from pathlib import Path
import math
import shutil
import subprocess
from typing import Any

from worker import (RestorationWorkerConfig, _safe_token, normalize_to_wav,
                    probe_path, receipt_id)

DRUM_MODEL = "drumsep-cpu-v1"
DRUM_ROLES = ("kick", "snare", "hihat", "cymbals", "toms")
MAX_DURATION_SECONDS = 20 * 60
MAX_DRUM_SOURCE_BYTES = 300 * 1024 * 1024


def package_version() -> str:
    try:
        return metadata.version("drumsep")
    except metadata.PackageNotFoundError:
        return "unavailable"


def _computed_residual(parent: Path, children: list[Path], residual: Path) -> dict[str, float]:
    """Exact-length residual for conservation; independent raw stem attribution is NOT guaranteed."""
    import numpy as np
    import soundfile as sf

    readers = [sf.SoundFile(parent), *(sf.SoundFile(path) for path in children)]
    try:
        rate, channels, frames = readers[0].samplerate, readers[0].channels, len(readers[0])
        if rate <= 0 or channels not in (1, 2) or frames == 0:
            raise ValueError("MUSIC_DEEP_DRUMS_INVALID_PARENT_DIMENSIONS")
        if any(reader.samplerate != rate or reader.channels != channels or len(reader) != frames
               for reader in readers[1:]):
            raise ValueError("MUSIC_DEEP_DRUMS_CHILD_SAMPLE_ALIGNMENT_INVALID")
        parent_energy = 0.0
        residual_energy = 0.0
        with sf.SoundFile(residual, "w", samplerate=rate, channels=channels, subtype="PCM_24") as writer:
            while True:
                base = readers[0].read(65536, dtype="float64", always_2d=True)
                if not len(base):
                    break
                result = base.copy()
                for reader in readers[1:]:
                    child = reader.read(len(base), dtype="float64", always_2d=True)
                    if child.shape != base.shape:
                        raise ValueError("MUSIC_DEEP_DRUMS_CHILD_SAMPLE_ALIGNMENT_INVALID")
                    result -= child
                parent_energy += float(np.sum(base * base))
                residual_energy += float(np.sum(result * result))
                writer.write(result)
        if parent_energy <= 0.0:
            raise ValueError("MUSIC_DEEP_DRUMS_SILENT_PARENT")
        ratio = math.sqrt(residual_energy / parent_energy)
        if not math.isfinite(ratio):
            raise ValueError("MUSIC_DEEP_DRUMS_RESIDUAL_NONFINITE")
        return {"residualRmsRatio": ratio, "residualEnergyRatio": residual_energy / parent_energy}
    finally:
        for reader in readers:
            reader.close()


def separate_drums_path(
    source_path: Path, source_artifact_id: str, source_sha256: str, job_id: str,
    parent_role: str, model_id: str, config: RestorationWorkerConfig,
) -> dict[str, Any]:
    if parent_role != "drums":
        raise ValueError("MUSIC_DEEP_DRUMS_PARENT_ROLE_NOT_ADMITTED")
    if model_id != DRUM_MODEL:
        raise ValueError("MUSIC_DEEP_DRUMS_MODEL_NOT_ADMITTED")
    if not shutil.which("drumsep"):
        raise RuntimeError("MUSIC_DEEP_DRUMS_OPTIONAL_MODEL_NOT_INSTALLED")
    parent_probe = probe_path(source_path, source_artifact_id, source_sha256)
    if (parent_probe["durationSeconds"] > MAX_DURATION_SECONDS
            or source_path.stat().st_size > MAX_DRUM_SOURCE_BYTES):
        raise ValueError("MUSIC_DEEP_DRUMS_RESOURCE_LIMIT")
    directory = config.output_dir / ("deep-drums-" + _safe_token(job_id))
    if directory.exists():
        raise ValueError("MUSIC_DEEP_DRUMS_JOB_ALREADY_EXISTS")
    directory.mkdir(parents=True, exist_ok=False)
    normalized = directory / "parent.wav"
    normalize_to_wav(source_path, normalized, parent_probe["sampleRate"], parent_probe["channels"])
    raw = directory / "raw"
    raw.mkdir()
    completed = subprocess.run(
        ["drumsep", str(normalized), "-o", str(raw)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=1800, check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError("MUSIC_DEEP_DRUMS_SEPARATION_FAILED:" +
                           completed.stdout.decode(errors="replace")[-800:])
    outputs: list[Path] = []
    for role in DRUM_ROLES:
        original = raw / (role + ".wav")
        if original.is_symlink() or not original.is_file() or original.stat().st_size <= 44:
            raise RuntimeError("MUSIC_DEEP_DRUMS_OUTPUT_MISSING:" + role)
        destination = directory / (role + ".wav")
        normalize_to_wav(original, destination, parent_probe["sampleRate"], parent_probe["channels"])
        outputs.append(destination)
    residual = directory / "residual.wav"
    qc = _computed_residual(normalized, outputs, residual)
    model_version = package_version()
    stems = []
    for role in (*DRUM_ROLES, "residual"):
        output = directory / (role + ".wav")
        digest = sha256(output.read_bytes()).hexdigest()
        artifact_id = f"music-deep-stem:{_safe_token(source_artifact_id)}:{role}:{digest[:16]}"
        evidence = probe_path(output, artifact_id, digest)
        if evidence["sampleRate"] != parent_probe["sampleRate"] or evidence["channels"] != parent_probe["channels"]:
            raise RuntimeError("MUSIC_DEEP_DRUMS_OUTPUT_DIMENSIONS_INVALID")
        if abs(evidence["sampleCount"] - parent_probe["sampleCount"]) > 512:
            raise RuntimeError("MUSIC_DEEP_DRUMS_OUTPUT_TIMEBASE_DRIFT")
        item = {
            "artifactId": artifact_id, "parentArtifactId": source_artifact_id,
            "role": role, "resultUri": f"/v1/jobs/{_safe_token(job_id)}/artifact/{role}.wav",
            "sha256": digest, "sampleRate": evidence["sampleRate"],
            "channels": evidence["channels"], "sampleCount": evidence["sampleCount"],
            "durationSeconds": evidence["durationSeconds"],
            "modelId": DRUM_MODEL, "modelVersion": model_version,
            "confidence": 0.0, "confidenceStatus": "unmeasured",
            "sourceKind": "recursive-separation",
        }
        item["runtimeReceiptId"] = receipt_id("music-deep-stem", item)
        stems.append(item)
    receipt = {
        "jobId": job_id, "sourceArtifactId": source_artifact_id,
        "sourceSha256": source_sha256.lower(), "parentRole": parent_role,
        "modelId": DRUM_MODEL, "modelVersion": model_version,
        "stems": stems, "qc": qc,
        "restorationCertified": False,
        "needsListeningReview": True,  # no invented confidence/zero-leakage claims
    }
    receipt["runtimeReceiptId"] = receipt_id("music-deep-separation", receipt)
    return receipt
