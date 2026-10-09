"""Optional Spotify Basic Pitch audio-to-MIDI for separated instrument stems.

Restoration sources are immutable. Output is explicitly a creative MIDI
transcription hypothesis; not recovered original MIDI or reconstructed audio.
Models are not auto-downloaded by this function. All private source staging and
owner authentication occurs in the existing Music Restoration HTTP boundary.
"""
from __future__ import annotations

from hashlib import sha256
from importlib import metadata, util
import os
from pathlib import Path
from typing import Any

from worker import RestorationWorkerConfig, _safe_token, probe_path, receipt_id

MODEL_ID = "spotify-basic-pitch-v1"
ROLES = frozenset(("guitar", "piano", "bass", "other"))
MAX_DURATION_SECONDS = 10 * 60
MAX_SOURCE_BYTES = 256 * 1024 * 1024
MAX_NOTES = 20000


def transcribe_performance_path(
    source_path: Path,
    source_artifact_id: str,
    source_sha256: str,
    job_id: str,
    parent_role: str,
    model_id: str,
    config: RestorationWorkerConfig,
) -> dict[str, Any]:
    if parent_role not in ROLES:
        raise ValueError("MUSIC_MIDI_SOURCE_MUST_BE_ISOLATED_INSTRUMENT")
    if model_id != MODEL_ID:
        raise ValueError("MUSIC_MIDI_MODEL_NOT_ADMITTED")
    if os.getenv("MUSIC_RESTORATION_BASIC_PITCH_ENABLED") != "YES":
        raise RuntimeError("MUSIC_MIDI_OPTIONAL_MODEL_NOT_ENABLED")
    if util.find_spec("basic_pitch") is None:
        raise RuntimeError("MUSIC_MIDI_BASIC_PITCH_NOT_INSTALLED")

    evidence = probe_path(source_path, source_artifact_id, source_sha256)
    if (evidence["durationSeconds"] > MAX_DURATION_SECONDS
            or source_path.stat().st_size > MAX_SOURCE_BYTES
            or evidence["channels"] not in (1, 2)):
        raise ValueError("MUSIC_MIDI_INPUT_LIMIT_EXCEEDED")

    directory = config.output_dir / ("transcribe-" + _safe_token(job_id))
    if directory.exists():
        raise ValueError("MUSIC_MIDI_JOB_ALREADY_EXISTS")
    directory.mkdir(parents=True, exist_ok=False)

    # Use Basic Pitch's packaged, locally installed model; never unpickle files
    # supplied by a user and never route prompts into shell arguments.
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict
    model_path = Path(ICASSP_2022_MODEL_PATH)
    if not model_path.exists():
        raise RuntimeError("MUSIC_MIDI_PACKAGED_MODEL_MISSING")
    _model_output, midi_data, _note_events = predict(str(source_path), model_or_model_path=model_path)
    notes = [note for instrument in midi_data.instruments for note in instrument.notes]
    if len(notes) == 0:
        raise ValueError("MUSIC_MIDI_NO_CONFIDENT_NOTES")
    if len(notes) > MAX_NOTES:
        raise ValueError("MUSIC_MIDI_TOO_MANY_NOTES")
    if any(not (0 <= note.pitch <= 127 and 0 <= note.velocity <= 127
                and 0 <= note.start < note.end <= evidence["durationSeconds"] + 2)
           for note in notes):
        raise ValueError("MUSIC_MIDI_NOTE_TIMING_INVALID")

    output = directory / "transcription.mid"
    midi_data.write(str(output))
    if not output.is_file() or not 20 <= output.stat().st_size <= 16 * 1024 * 1024:
        raise RuntimeError("MUSIC_MIDI_OUTPUT_INVALID")

    actual_sha = sha256(output.read_bytes()).hexdigest()
    artifact_id = "music-midi:" + _safe_token(source_artifact_id) + ":" + actual_sha[:16]
    payload = {
        "jobId": job_id, "sourceArtifactId": source_artifact_id,
        "parentArtifactId": source_artifact_id,
        "sourceSha256": source_sha256.lower(),
        "parentRole": parent_role,
        "modelId": MODEL_ID,
        "modelVersion": metadata.version("basic-pitch"),
        "outputArtifactId": artifact_id,
        "resultUri": "/v1/jobs/" + _safe_token(job_id) + "/artifact/transcription.mid",
        "outputSha256": actual_sha,
        "midiBytes": output.stat().st_size,
        "noteCount": len(notes),
        "sampleRate": evidence["sampleRate"],
        "channels": evidence["channels"],
        "sampleCount": evidence["sampleCount"],
        "durationSeconds": evidence["durationSeconds"],
        "operationClass": "creative-reconstruction",
        "isOriginalPerformanceRecovered": False,
        "needsHumanReview": True,
        "restorationCertified": False,
    }
    payload["runtimeReceiptId"] = receipt_id("music-midi-transcription", payload)
    return payload
