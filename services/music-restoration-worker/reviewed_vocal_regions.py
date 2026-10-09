"""Human-annotated vocal region renders, not automated voice disentanglement.

A reviewed time region can be routed to an editable, synchronized ad-lib,
harmony or backing-vocal *candidate* track. If multiple voices overlap in one
region, they REMAIN mixed in that candidate. No claimed speaker identity and
no source samples are erased: the FLOAT residual conserves the parent audio.
"""
from __future__ import annotations
from hashlib import sha256
import math
from pathlib import Path
from typing import Any

from worker import RestorationWorkerConfig, _safe_token, probe_path, normalize_to_wav, receipt_id

ROLES = frozenset(("lead", "backing", "double", "harmony", "ad-lib",
                   "spoken", "shout", "response", "effect", "breath"))
MAX_DURATION_SEC = 300
MAX_REGIONS = 64
MAX_LAYERS = 6
MAX_SOURCE_BYTES = 200 * 1024 * 1024


def render_reviewed_vocal_regions(
    source_path: Path, artifact_id: str, source_sha256: str,
    job_id: str, parent_role: str, regions: list[dict[str, Any]],
    config: RestorationWorkerConfig,
) -> dict[str, Any]:
    if parent_role != "vocals":
        raise ValueError("MUSIC_VOCAL_REGIONS_REQUIRE_SEPARATED_VOCALS")
    if not 1 <= len(regions) <= MAX_REGIONS:
        raise ValueError("MUSIC_VOCAL_REGIONS_COUNT_INVALID")
    source_info = probe_path(source_path, artifact_id, source_sha256)
    if source_info["durationSeconds"] > MAX_DURATION_SEC or source_path.stat().st_size > MAX_SOURCE_BYTES:
        raise ValueError("MUSIC_VOCAL_REGIONS_SOURCE_LIMIT")
    normalized_roles = {}
    evidence_ids = set()
    for item in regions:
        role = item.get("role")
        if role not in ROLES:
            raise ValueError("MUSIC_VOCAL_REGIONS_ROLE_INVALID")
        if item.get("ownerReviewed") is not True or not str(item.get("reviewEvidenceId", "")).strip():
            raise ValueError("MUSIC_VOCAL_REGIONS_OWNER_REVIEW_REQUIRED")
        evidence = item["reviewEvidenceId"].strip()
        if evidence in evidence_ids:
            raise ValueError("MUSIC_VOCAL_REGIONS_REVIEW_EVIDENCE_DUPLICATED")
        evidence_ids.add(evidence)
        try:
            start, end = float(item["startMs"]), float(item["endMs"])
        except (KeyError, ValueError, TypeError) as exc:
            raise ValueError("MUSIC_VOCAL_REGIONS_TIME_INVALID") from exc
        if (not math.isfinite(start) or not math.isfinite(end) or start < 0 or
            end - start < 50 or end > source_info["durationSeconds"] * 1000 + 1):
            raise ValueError("MUSIC_VOCAL_REGIONS_TIME_INVALID")
        normalized_roles.setdefault(role, []).append((start, end, evidence))
    if len(normalized_roles) > MAX_LAYERS:
        raise ValueError("MUSIC_VOCAL_REGIONS_TOO_MANY_LAYERS")
    # A single region can be annotated to one candidate role. Do not
    # duplicate the same audio under two labels and imply independent sources.
    all_regions = sorted(
        (start, end, role) for role, items in normalized_roles.items()
        for start, end, _ in items
    )
    for prev, current in zip(all_regions, all_regions[1:]):
        if current[0] < prev[1]:
            raise ValueError("MUSIC_VOCAL_REGIONS_OVERLAP_AMBIGUOUS")
    directory = config.output_dir / ("vocal-regions-" + _safe_token(job_id))
    if directory.exists():
        raise ValueError("MUSIC_VOCAL_REGIONS_JOB_EXISTS")
    directory.mkdir(parents=True, exist_ok=False)
    source = directory / "parent.wav"
    normalize_to_wav(source_path, source, source_info["sampleRate"], source_info["channels"])

    import numpy as np
    import soundfile as sf
    with sf.SoundFile(source) as parent:
        rate, channels, frames = parent.samplerate, parent.channels, len(parent)
    if (rate != source_info["sampleRate"] or channels != source_info["channels"] or
        abs(frames - source_info["sampleCount"]) > 512):
        raise ValueError("MUSIC_VOCAL_REGIONS_PARENT_TIMEBASE")
    if frames * channels * 4 * (len(normalized_roles) + 1) > 2 * 1024 ** 3:
        raise ValueError("MUSIC_VOCAL_REGIONS_OUTPUT_BUDGET")
    role_spans: dict[str, list[tuple[int, int]]] = {}
    for role, items in normalized_roles.items():
        role_spans[role] = [
            (max(0, round(a * rate / 1000)), min(frames, round(b * rate / 1000)))
            for a, b, _ in items
        ]
    outputs = {}
    try:
        with sf.SoundFile(source) as parent:
            with sf.SoundFile(directory / "residual.wav", "w", samplerate=rate,
                              channels=channels, subtype="FLOAT") as residual:
                for role in role_spans:
                    outputs[role] = sf.SoundFile(directory / (role + ".wav"), "w",
                                                 samplerate=rate, channels=channels,
                                                 subtype="FLOAT")
                try:
                    offset = 0
                    while offset < frames:
                        base = parent.read(min(32768, frames - offset), dtype="float64", always_2d=True)
                        if not np.all(np.isfinite(base)):
                            raise ValueError("MUSIC_VOCAL_REGIONS_NONFINITE_AUDIO")
                        rem = base.copy()
                        positions = np.arange(offset, offset + len(base))
                        for role, spans in role_spans.items():
                            mask = np.zeros(len(base), dtype="float64")
                            for a, b in spans:
                                fade = max(1, min(round(rate * .005), (b-a)//4))
                                selection = (positions >= a) & (positions < b)
                                if not np.any(selection):
                                    continue
                                local = positions[selection]
                                envelope = np.minimum(
                                    1.0, np.minimum((local-a)/fade, (b-1-local)/fade)
                                )
                                mask[selection] = np.maximum(mask[selection], envelope)
                            child = base * mask[:, None]
                            outputs[role].write(child)
                            rem -= child
                        residual.write(rem)
                        offset += len(base)
                finally:
                    for handle in outputs.values():
                        handle.close()
    except Exception:
        # Never issue artifacts or a success receipt on partially written audio.
        raise
    energy, delta_energy, max_error = 0.0, 0.0, 0.0
    with sf.SoundFile(source) as parent, sf.SoundFile(directory / "residual.wav") as rem, \
         __import__("contextlib").ExitStack() as stack:
        read_children = [stack.enter_context(sf.SoundFile(directory / (role + ".wav")))
                         for role in role_spans]
        while True:
            original = parent.read(32768, dtype="float64", always_2d=True)
            if not len(original):
                break
            reconstructed = rem.read(len(original), dtype="float64", always_2d=True)
            for child in read_children:
                reconstructed += child.read(len(original), dtype="float64", always_2d=True)
            error = original - reconstructed
            if not np.all(np.isfinite(error)):
                raise ValueError("MUSIC_VOCAL_REGIONS_SUM_NONFINITE")
            energy += float(np.sum(original**2))
            delta_energy += float(np.sum(error**2))
            max_error = max(max_error, float(np.max(np.abs(error))))
    if energy < 1e-14:
        raise ValueError("MUSIC_VOCAL_REGIONS_SILENT_PARENT")
    ratio = math.sqrt(delta_energy / energy)
    if ratio > 2e-6 or max_error > 5e-5:
        raise ValueError("MUSIC_VOCAL_REGIONS_SUM_FAILED")
    stems = []
    for role in (*role_spans.keys(), "residual"):
        path = directory / (role + ".wav")
        digest = sha256(path.read_bytes()).hexdigest()
        out_id = "music-vocal-regions:" + _safe_token(artifact_id) + ":" + role + ":" + digest[:16]
        item = {
            "artifactId": out_id, "parentArtifactId": artifact_id,
            "role": role, "resultUri": "/v1/jobs/" + _safe_token(job_id) + "/artifact/" + role + ".wav",
            "sha256": digest, "sampleRate": rate, "channels": channels, "sampleCount": frames,
            "sourceKind": "reviewed-region-mask", "modelId": "reviewed-vocal-mask-v1",
            "confidenceStatus": "human-annotation-not-isolation",
            "reviewEvidenceIds": [x[2] for x in normalized_roles.get(role, [])],
        }
        item["runtimeReceiptId"] = receipt_id("vocal-region-stem", item)
        stems.append(item)
    payload = {
        "jobId": job_id, "sourceArtifactId": artifact_id, "sourceSha256": source_sha256.lower(),
        "parentRole": "vocals", "stems": stems,
        "qc": {"recombinationErrorRatio": ratio, "maxAbsoluteRecombinationError": max_error,
               "recombinedRenderMeasured": True, "isolationCertified": False},
        "outputClass": "human-reviewed-time-region-masks",
        "automatedSpeakerSeparationPerformed": False,
        "needsListeningReview": True, "restorationCertified": False,
    }
    payload["runtimeReceiptId"] = receipt_id("reviewed-vocal-regions", payload)
    return payload
