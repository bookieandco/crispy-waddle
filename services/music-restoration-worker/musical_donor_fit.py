"""Measured musical compatibility for same-instrument donor candidates.

CPU-only deterministic coarse spectral chroma and energy-transient measurements.
This is not a trained instrument classifier, not transcription of exact notes,
and not proof of authentic sound. No auto-reconstruction is ever authorized.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

MAX_EVENTS = 64
MAX_REGION_SECONDS = 12
PITCHED_FAMILIES = frozenset((
    "acoustic-guitar", "electric-guitar", "piano", "organ", "strings",
    "brass", "woodwinds", "bass", "synth",
))


def _region_features(path: Path, start_ms: float, end_ms: float) -> dict[str, Any]:
    import numpy as np
    import soundfile as sf
    if (not math.isfinite(start_ms) or not math.isfinite(end_ms)
            or start_ms < 0 or not 100 <= end_ms - start_ms <= MAX_REGION_SECONDS * 1000):
        raise ValueError("MUSIC_MUSICAL_FIT_REGION_INVALID")
    with sf.SoundFile(path) as file:
        rate = file.samplerate
        if rate < 8000 or rate > 192000 or file.channels not in (1, 2):
            raise ValueError("MUSIC_MUSICAL_FIT_SOURCE_FORMAT_UNSUPPORTED")
        begin = round(start_ms * rate / 1000)
        finish = round(end_ms * rate / 1000)
        if finish > len(file):
            raise ValueError("MUSIC_MUSICAL_FIT_REGION_OUT_OF_BOUNDS")
        file.seek(begin)
        samples = file.read(finish - begin, dtype="float64", always_2d=True)
    if samples.size == 0 or not np.all(np.isfinite(samples)):
        raise ValueError("MUSIC_MUSICAL_FIT_SOURCE_NONFINITE")
    mono = np.mean(samples, axis=1)
    # Bounded stride lets long/hi-rate audio be measured without full FFT
    # allocation or the heavy optional librosa/ML stack.
    stride = max(1, round(rate / 16000))
    mono = mono[::stride]
    effective_rate = rate / stride
    n_fft = 4096
    hop = 2048
    if len(mono) < 2048:
        raise ValueError("MUSIC_MUSICAL_FIT_TOO_SHORT")
    if len(mono) < n_fft:
        mono = np.pad(mono, (0, n_fft - len(mono)))
    indices = list(range(0, len(mono) - n_fft + 1, hop))
    if len(indices) > 256:
        step = math.ceil(len(indices) / 256)
        indices = indices[::step]
    freqs = np.fft.rfftfreq(n_fft, 1 / effective_rate)
    valid = (freqs >= 60) & (freqs <= min(1800, effective_rate * 0.45))
    if not np.any(valid):
        raise ValueError("MUSIC_MUSICAL_FIT_NO_AUDIO_BAND")
    pitches = np.rint(69 + 12 * np.log2(freqs[valid] / 440.0)).astype(int) % 12
    weights = np.zeros(12, dtype=np.float64)
    envelopes = []
    window = np.hanning(n_fft)
    for start in indices:
        frame = mono[start:start+n_fft]
        rms = float(np.sqrt(np.mean(frame * frame)))
        envelopes.append(rms)
        if rms < 1e-4:
            continue
        spectrum = np.abs(np.fft.rfft(frame * window))
        magnitudes = np.square(spectrum[valid])
        # Whitening mitigates dominance from one recording's frequency response.
        normalization = float(np.sum(magnitudes)) + 1e-12
        weights += np.bincount(pitches, weights=magnitudes / normalization, minlength=12)
    total = float(np.sum(weights))
    if not math.isfinite(total) or total < 0.001:
        return {"resolved": False, "chroma": [0.0] * 12,
                "transientRate": 0.0, "voicedWindows": 0}
    weights /= total
    rms_values = np.asarray(envelopes)
    differences = np.diff(rms_values)
    threshold = max(.003, float(np.std(differences)) * 1.75)
    impulses = sum(1 for i, delta in enumerate(differences)
                   if delta > threshold and (i == 0 or differences[i-1] <= threshold))
    duration = (end_ms - start_ms) / 1000
    return {"resolved": True, "chroma": weights.tolist(),
            "transientRate": float(impulses) / duration,
            "voicedWindows": int(sum(x >= 1e-4 for x in envelopes))}


def measure_musical_donor_fit(
    source_path: Path,
    donor_path: Path,
    segments: list[dict[str, Any]],
    family: str,
) -> dict[str, Any]:
    if family not in PITCHED_FAMILIES:
        return {"status": "not-applicable", "compatible": False,
                "requiresHumanReview": True, "reason": "No pitched-instrument decision supported."}
    if not 1 <= len(segments) <= MAX_EVENTS:
        raise ValueError("MUSIC_MUSICAL_FIT_SEGMENT_COUNT_INVALID")
    import numpy as np
    results = []
    for segment in segments:
        a, b = float(segment["sourceStartMs"]), float(segment["sourceEndMs"])
        c, d = float(segment["replacementStartMs"]), float(segment["replacementEndMs"])
        x, y = _region_features(source_path, a, b), _region_features(donor_path, c, d)
        duration_ratio = min(b-a, d-c) / max(b-a, d-c)
        if not x["resolved"] or not y["resolved"]:
            results.append({"status": "unresolved", "pitchClassSimilarity": 0.0,
                            "transientSimilarity": 0.0, "durationFit": duration_ratio})
            continue
        left, right = np.asarray(x["chroma"]), np.asarray(y["chroma"])
        norm = float(np.linalg.norm(left) * np.linalg.norm(right))
        chroma = float(np.dot(left, right) / norm) if norm > 1e-9 else 0.0
        transient = float(min(x["transientRate"]+1, y["transientRate"]+1) /
                          max(x["transientRate"]+1, y["transientRate"]+1))
        # A dominant shared pitch class is insufficient for complex guitar
        # chords or rhythmic identity; require an owner's A/B approval always.
        status = ("compatible" if chroma >= .78 and transient >= .55 and duration_ratio >= .5
                  else "mismatch")
        results.append({"status": status, "pitchClassSimilarity": chroma,
                        "transientSimilarity": transient, "durationFit": duration_ratio})
    statuses = [x["status"] for x in results]
    status = ("unresolved" if "unresolved" in statuses else
              "compatible" if all(x == "compatible" for x in statuses) else "mismatch")
    return {"status": status, "compatible": status == "compatible",
            "requiresHumanReview": True, "pitchEstimator": "fft-energy-chroma-v1",
            "sourceFamilyExternallyVerified": False,
            "segments": results,
            "reason": ("Compatible coarse measured chroma/rhythm only; note/chord and instrument identity require owner review."
                       if status == "compatible" else
                       "Performance pitch/rhythm was incompatible or not resolved; keep original and review.")}
