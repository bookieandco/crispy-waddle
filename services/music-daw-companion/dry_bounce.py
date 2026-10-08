"""JHADINA-DAW.7: deterministic, streaming, full-length, **dry** WAV bounce.

Does not run plugins, EQ, or compressor: fail CLOSED when active, rather than
silently dropping effects. Source hashes, sample times, and owner-scoped
operator-provided audio locations are verified. Float WAV avoids clipping
data; peaks >1.0 are reported as needing mixing review. No source overwrite.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math
from pathlib import Path
import re
from typing import Any

import numpy as np
import soundfile as sf

SCHEMA = "jhadina-music-daw/v1"
SHA = re.compile(r"^[a-f0-9]{64}$")
BLOCK = 8192
MAX_DURATION_SECONDS = 1800
MAX_TRACKS = 48
MAX_TRACK_CLIPS = 64


def _fail(reason: str):
    raise ValueError("MUSIC_DAW_BOUNCE_" + reason)


def _seconds_to_sample(seconds: object, rate: int) -> int:
    if not isinstance(seconds, (int, float)) or isinstance(seconds, bool) or not math.isfinite(seconds):
        _fail("INVALID_TIME")
    if seconds < 0 or seconds > MAX_DURATION_SECONDS:
        _fail("TIME_OUT_OF_BOUNDS")
    sample = round(seconds * rate)
    if abs(sample / rate - seconds) > 0.51 / rate:
        _fail("TIME_NOT_SAMPLE_ALIGNED")
    return sample


def _sha_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _source_path(root: Path, user_path: str) -> Path:
    if not isinstance(user_path, str) or not user_path or "\x00" in user_path:
        _fail("ASSET_PATH_INVALID")
    # Disallow symlink directory traversal as well as files themselves.
    path = root / user_path
    if path.is_symlink() or any(parent.is_symlink() for parent in path.parents if parent != root):
        _fail("ASSET_SYMLINK_FORBIDDEN")
    real = path.resolve()
    if root not in real.parents or not real.is_file() or real.suffix.lower() != ".wav":
        _fail("ASSET_OUTSIDE_AUDIO_ROOT")
    return real


def _validated_lanes(track: dict[str, Any], max_seconds: float) -> dict[str, list[tuple[float, float]]]:
    automation = track.get("automation", {})
    if not isinstance(automation, dict) or any(k not in ("gainDb", "pan") for k in automation):
        _fail("AUTOMATION_INVALID")
    compiled = {}
    for lane, minimum, maximum in (("gainDb", -60, 12), ("pan", -1, 1)):
        points = automation.get(lane, [])
        if not isinstance(points, list) or len(points) > 256:
            _fail("AUTOMATION_POINT_COUNT_INVALID")
        times = []
        for point in points:
            if not isinstance(point, dict):
                _fail("AUTOMATION_POINT_INVALID")
            time, value = point.get("atSeconds"), point.get("value")
            if not isinstance(time, (int,float)) or isinstance(time,bool) or \
               not math.isfinite(time) or not 0 <= time <= max_seconds or \
               not isinstance(value, (int,float)) or isinstance(value,bool) or \
               not math.isfinite(value) or not minimum <= value <= maximum or \
               (times and time <= times[-1][0]):
                _fail("AUTOMATION_POINT_INVALID")
            times.append((float(time),float(value)))
        compiled[lane] = times
    return compiled


def render_dry_session(
    session: dict[str, Any], assets: list[dict[str, Any]],
    root_dir: Path, output_file: Path,
) -> dict[str, Any]:
    if session.get("schemaVersion") != SCHEMA or not isinstance(session.get("caseId"), str) \
       or not session["caseId"] or not isinstance(session.get("revision"), int) \
       or isinstance(session["revision"], bool) or session["revision"] < 0:
        _fail("DOCUMENT_INVALID")
    tracks = session.get("tracks")
    if not isinstance(tracks, list) or not 1 <= len(tracks) <= MAX_TRACKS:
        _fail("TRACK_COUNT_INVALID")
    if not isinstance(assets, list) or len(assets) > MAX_TRACKS * 2:
        _fail("ASSET_REGISTRY_INVALID")
    audio_root = root_dir.resolve(strict=True)
    if not audio_root.is_dir():
        _fail("AUDIO_ROOT_INVALID")
    output = output_file.resolve()
    if output == audio_root or output.is_relative_to(audio_root):
        _fail("OUTPUT_MUST_BE_OUTSIDE_SOURCE_ROOT")
    if output.exists():
        _fail("OUTPUT_ALREADY_EXISTS")
    if not output.parent.is_dir():
        _fail("OUTPUT_DIRECTORY_NOT_FOUND")
    registry = {}
    for asset in assets:
        if not isinstance(asset, dict) or not isinstance(asset.get("id"), str) or \
           asset["id"] in registry or not SHA.fullmatch(str(asset.get("sha256", "")).lower()):
            _fail("ASSET_REGISTRY_INVALID")
        registry[asset["id"]] = asset
    solo = any(t.get("solo") is True and t.get("mute") is False for t in tracks if isinstance(t, dict))
    audible: list[tuple[dict, list[tuple[int, int, int, int, int]], Path, int,
                         dict[str, list[tuple[float, float]]]]] = []
    seen = set()
    sources = {}
    rate = 0
    duration = 0
    all_clips = 0
    try:
        for track in tracks:
            if not isinstance(track, dict):
                _fail("TRACK_INVALID")
            aid = track.get("artifactId")
            if not isinstance(aid, str) or aid in seen or aid not in registry:
                _fail("TRACK_SOURCE_ID_INVALID")
            seen.add(aid)
            asset = registry[aid]
            if not SHA.fullmatch(str(track.get("sourceSha256", "")).lower()) or \
               track["sourceSha256"].lower() != asset["sha256"].lower():
                _fail("TRACK_SHA_MISMATCH")
            clips = track.get("clips")
            if not isinstance(clips, list) or len(clips) > MAX_TRACK_CLIPS:
                _fail("CLIP_COUNT_INVALID")
            if not isinstance(track.get("mute"), bool) or not isinstance(track.get("solo"), bool):
                _fail("TRACK_MUTE_SOLO_INVALID")
            all_clips += len(clips)
            if all_clips > 1024:
                _fail("TOTAL_CLIPS_LIMIT")
            if track["mute"] or (solo and not track["solo"]):
                continue
            gain_db, pan = track.get("gainDb"), track.get("pan")
            if not isinstance(gain_db, (float, int)) or isinstance(gain_db, bool) or \
               not math.isfinite(gain_db) or not -60 <= gain_db <= 12 or \
               not isinstance(pan, (float, int)) or isinstance(pan, bool) or \
               not math.isfinite(pan) or not -1 <= pan <= 1:
                _fail("MIX_CONTROL_INVALID")
            eq = track.get("eq")
            comp = track.get("compressor")
            if not isinstance(eq, dict) or \
               any(eq.get(k) != 0 for k in ("lowDb", "midDb", "highDb")) or \
               not isinstance(comp, dict) or comp.get("enabled") is not False or \
               any(p.get("enabled") is not False for p in track.get("pluginRack", [])):
                _fail("ACTIVE_DSP_REQUIRES_PROCESSED_STEM_OR_NATIVE_BOUNCE")
            # Silent bypass is forbidden: the full edited track may only be
            # called a DRY mix if every active DSP is explicitly disabled.
            path = _source_path(audio_root, asset.get("localPath"))
            if _sha_file(path) != track["sourceSha256"].lower():
                _fail("SOURCE_HASH_MISMATCH")
            source = sf.SoundFile(path)
            sources[aid] = source
            if source.channels not in (1, 2) or source.samplerate not in (44100, 48000, 96000):
                _fail("SOURCE_FORMAT_UNSUPPORTED")
            if rate == 0:
                rate = source.samplerate
            if source.samplerate != rate:
                _fail("SOURCE_RATE_MISMATCH")
            if source.frames != asset.get("sampleCount") or \
               source.samplerate != asset.get("sampleRate"):
                _fail("SOURCE_TIMEBASE_MISMATCH")
            if not math.isclose(track.get("durationSeconds", -1), source.frames / rate,
                                abs_tol=0.01, rel_tol=0):
                _fail("SOURCE_DURATION_MISMATCH")
            positions = []
            prev_end = 0
            for clip in sorted(clips, key=lambda c: c.get("startSeconds", -1)):
                start = _seconds_to_sample(clip.get("startSeconds"), rate)
                end = _seconds_to_sample(clip.get("endSeconds"), rate)
                off = _seconds_to_sample(clip.get("sourceOffsetSeconds"), rate)
                fadein = _seconds_to_sample(clip.get("fadeInSeconds"), rate)
                fadeout = _seconds_to_sample(clip.get("fadeOutSeconds"), rate)
                if not 0 <= start < end or off < 0 or off + end - start > source.frames or \
                   max(fadein, fadeout) > end - start or start < prev_end:
                    _fail("CLIP_BOUNDARY_INVALID")
                positions.append((start, end, off, fadein, fadeout))
                prev_end = end
                duration = max(duration, end)
            if positions:
                lanes = _validated_lanes(track, max(duration, source.frames) / rate)
                audible.append((track, positions, path, source.channels, lanes))
        if not audible or not duration or not rate or duration > MAX_DURATION_SECONDS * rate:
            _fail("NO_AUDIBLE_AUDIO")
        peaks = 0.0
        rms_power = 0.0
        nonfinite = 0
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            with sf.SoundFile(output, mode="x", samplerate=rate,
                              channels=2, format="WAV", subtype="FLOAT") as writer:
                for frame in range(0, duration, BLOCK):
                    n = min(BLOCK, duration-frame)
                    summed = np.zeros((n, 2), dtype=np.float64)
                    for track, positions, _, channels, lanes in audible:
                        src = sources[track["artifactId"]]
                        for start, end, offset, fadein, fadeout in positions:
                            a, b = max(start, frame), min(end, frame+n)
                            if a >= b:
                                continue
                            src.seek(offset+a-start)
                            raw = src.read(b-a, dtype="float64", always_2d=True)
                            if raw.shape != (b-a, channels) or not np.all(np.isfinite(raw)):
                                _fail("SOURCE_NONFINITE_OR_SHORT")
                            elapsed = np.arange(a, b, dtype=np.float64) - start
                            remaining = end - np.arange(a, b, dtype=np.float64)
                            envelope = np.ones(b-a, dtype=np.float64)
                            if fadein:
                                envelope = np.minimum(envelope, elapsed / fadein)
                            if fadeout:
                                envelope = np.minimum(envelope, remaining / fadeout)
                            if channels == 1:
                                raw = np.repeat(raw, 2, axis=1)
                            raw *= envelope[:, None]
                            seconds = np.arange(a,b,dtype=np.float64)
                            gain_db = _automation_samples(lanes["gainDb"], seconds, rate,
                                                          float(track["gainDb"]))
                            pan = _automation_samples(lanes["pan"], seconds, rate,
                                                      float(track["pan"]))
                            gain = np.power(10.0, gain_db/20.0)
                            left = np.where(pan <= 0, 1.0, np.cos(pan*math.pi/2))
                            right = np.where(pan >= 0, 1.0, np.cos(-pan*math.pi/2))
                            raw[:, 0] *= gain*left
                            raw[:, 1] *= gain*right
                            summed[a-frame:b-frame, :] += raw
                    if not np.all(np.isfinite(summed)):
                        nonfinite += 1
                        _fail("MIX_NONFINITE")
                    peaks = max(peaks, float(np.max(np.abs(summed))))
                    rms_power += float(np.sum(summed * summed))
                    writer.write(summed.astype(np.float32))
        except BaseException:
            if output.exists():
                output.unlink()
            raise
        if not output.is_file():
            _fail("OUTPUT_MISSING")
        with sf.SoundFile(output) as check:
            if check.frames != duration or check.samplerate != rate or \
               check.channels != 2 or check.subtype != "FLOAT":
                _fail("OUTPUT_READBACK_MISMATCH")
        receipt = {
            "schema": "jhadina-music-daw-dry-bounce/v1",
            "caseId": session["caseId"], "revision": session["revision"],
            "operationClass": "non-destructive-dry-edit-bounce",
            "outputSha256": _sha_file(output),
            "sampleRate": rate, "sampleCount": duration, "channels": 2,
            "tracksAudible": [x[0]["artifactId"] for x in audible],
            "sourceSha256": {x[0]["artifactId"]: x[0]["sourceSha256"] for x in audible},
            "maxAbsolutePeak": peaks,
            "peakAboveFullScale": peaks > 1.0,
            "rms": math.sqrt(rms_power / (2*duration)),
            "outputFormat": "WAV/IEEE-float32",
            "pluginsExecuted": False, "eqExecuted": False,
            "compressionExecuted": False, "requiresListeningReview": True,
            "originalRecovered": False, "restorationCertified": False,
            "sourceImmutable": True, "nonfiniteChunks": nonfinite,
        }
        receipt["receiptSha256"] = sha256(json.dumps(receipt, sort_keys=True).encode()).hexdigest()
        return receipt
    finally:
        for source in sources.values():
            source.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="CPU-only dry non-destructive DAW mix export; fails if FX active")
    parser.add_argument("--session", required=True)
    parser.add_argument("--assets", required=True)
    parser.add_argument("--audio-root", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    with open(args.session, encoding="utf-8") as source:
        session_doc = json.load(source)
    with open(args.assets, encoding="utf-8") as source:
        asset_registry = json.load(source)
    print(json.dumps(render_dry_session(session_doc, asset_registry, Path(args.audio_root), Path(args.output)), indent=2))
