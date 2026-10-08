"""JHADINA-DAW.7 edited multistem dry bounce: exact, full-length WAVs.

A complete owner-saved DAW document and the corresponding separately downloaded
SHA-bound source WAVs are required. One mix + individually edited stereo WAV
per audible track; all retain a shared sample clock, split/slip/fade, automation,
gain/pan and solo/mute, with independently re-read null QC. No DSP deception.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
import tempfile
from typing import Any

import numpy as np
import soundfile as sf

from dry_bounce import render_dry_session

MAX_EXPORT_BYTES = 4 * 1024 * 1024 * 1024
BLOCK = 8192


def verify_dry_stem_null(master: Path, stems: list[Path]) -> dict[str, float | bool]:
    """Measure *on disk*, not in-memory output buffers. Fail over missing,
    desynchronized, nonfinite or acoustically non-summing edited stems.
    """
    if not stems:
        raise ValueError("MUSIC_DAW_STEM_NULL_EMPTY")
    residual2 = source2 = max_error = 0.0
    with sf.SoundFile(master) as reference:
        if reference.channels != 2 or reference.subtype != "FLOAT":
            raise ValueError("MUSIC_DAW_STEM_NULL_MASTER_FORMAT")
        opened = []
        try:
            for path in stems:
                audio = sf.SoundFile(path)
                opened.append(audio)
                if (audio.frames != reference.frames or audio.samplerate != reference.samplerate
                        or audio.channels != 2 or audio.subtype != "FLOAT"):
                    raise ValueError("MUSIC_DAW_STEM_NULL_TIMEBASE_MISMATCH")
            for start in range(0, reference.frames, BLOCK):
                n = min(BLOCK, reference.frames-start)
                original = reference.read(n, dtype="float64", always_2d=True)
                result = np.zeros((n, 2), dtype=np.float64)
                for audio in opened:
                    child = audio.read(n, dtype="float64", always_2d=True)
                    if child.shape != original.shape or not np.all(np.isfinite(child)):
                        raise ValueError("MUSIC_DAW_STEM_NULL_CHILD_CORRUPT")
                    result += child
                if not np.all(np.isfinite(original)):
                    raise ValueError("MUSIC_DAW_STEM_NULL_MASTER_CORRUPT")
                error = original-result
                max_error = max(max_error,float(np.max(np.abs(error))))
                residual2 += float(np.sum(error*error))
                source2 += float(np.sum(original*original))
        finally:
            for audio in opened:
                audio.close()
    ratio = (residual2 / max(source2,1e-18))**.5
    if max_error > 4e-5 or ratio > 2e-5:
        raise ValueError("MUSIC_DAW_STEM_NULL_MIX_MISMATCH")
    return {"passed": True, "maxAbsoluteError": max_error, "residualRatio": ratio}


def render_dry_stem_set(
    session: dict[str, Any], assets: list[dict[str, Any]],
    audio_root: Path, output_directory: Path,
) -> dict[str, Any]:
    tracks = session.get("tracks")
    if not isinstance(tracks, list):
        raise ValueError("MUSIC_DAW_STEM_EXPORT_INVALID_DOCUMENT")
    selected_solo = any(t.get("solo") is True and t.get("mute") is False
                        for t in tracks if isinstance(t, dict))
    audible = [t for t in tracks if isinstance(t, dict) and
               t.get("mute") is False and (not selected_solo or t.get("solo") is True)
               and isinstance(t.get("clips"), list) and t["clips"]]
    if not 1 <= len(audible) <= 48:
        raise ValueError("MUSIC_DAW_STEM_EXPORT_NO_AUDIBLE_TRACKS")
    root = audio_root.resolve(strict=True)
    parent = output_directory.parent.resolve(strict=True)
    target = parent / output_directory.name
    if (not output_directory.name or output_directory.name in (".", "..") or
            target.exists() or target.is_symlink() or parent == root or
            root in parent.parents or parent in root.parents):
        raise ValueError("MUSIC_DAW_STEM_EXPORT_OUTPUT_LOCATION_INVALID")
    # Never create/truncate any original source, even if output is malformed.
    staging = Path(tempfile.mkdtemp(prefix=".jhadina-dry-stage-", dir=parent))
    try:
        (staging/"stems").mkdir()
        mix_path = staging/"mix.wav"
        master = render_dry_session(session, assets, root, mix_path)
        total_size = (len(audible)+1)*master["sampleCount"]*2*4
        if total_size > MAX_EXPORT_BYTES:
            raise ValueError("MUSIC_DAW_STEM_EXPORT_DISK_BUDGET_EXCEEDED")
        stems = []
        for idx, track in enumerate(audible, start=1):
            path = staging/"stems"/f"track-{idx:02d}.wav"
            one = deepcopy(session)
            one["tracks"] = [track]
            receipt = render_dry_session(one, assets, root, path,
                                         timeline_frames=master["sampleCount"])
            if (receipt["sampleRate"] != master["sampleRate"] or
                    receipt["sampleCount"] != master["sampleCount"]):
                raise ValueError("MUSIC_DAW_STEM_EXPORT_TIMEBASE_MISMATCH")
            stems.append({"artifactId":track["artifactId"],
                          "fileName":f"stems/track-{idx:02d}.wav",
                          "outputSha256":receipt["outputSha256"],
                          "sampleCount":receipt["sampleCount"],
                          "sourceSha256":track["sourceSha256"]})
        null = verify_dry_stem_null(mix_path,
                                    [staging/row["fileName"] for row in stems])
        report = {"schema":"jhadina-music-daw-edited-stems/v1",
                  "caseId":session["caseId"], "revision":session["revision"],
                  "operationClass":"non-destructive-edited-stems-dry-bounce",
                  "masterOutputSha256":master["outputSha256"],
                  "sampleRate":master["sampleRate"],
                  "sampleCount":master["sampleCount"], "channels":2,
                  "sourcesImmutable":True,
                  "pluginsExecuted":False, "eqExecuted":False,
                  "compressionExecuted":False, "restorationCertified":False,
                  "needsListeningReview":True, "peakAboveFullScale":master["peakAboveFullScale"],
                  "stems":stems,"readbackNullQc":null}
        report["receiptSha256"]=sha256(json.dumps(report,sort_keys=True).encode()).hexdigest()
        (staging/"edited-stems-receipt.json").write_text(
            json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        # Atomic directory visibility; stop on preexisting output, never overwrite.
        if target.exists():
            raise ValueError("MUSIC_DAW_STEM_EXPORT_DESTINATION_RACED")
        os.rename(staging,target)
        return report
    finally:
        if staging.exists():
            shutil.rmtree(staging)


if __name__ == "__main__":
    import argparse
    cli=argparse.ArgumentParser(description="Export sample-aligned, SHA-checked edited dry WAV stems + mix")
    cli.add_argument("--session",required=True)
    cli.add_argument("--assets",required=True)
    cli.add_argument("--audio-root",required=True)
    cli.add_argument("--output-dir",required=True)
    args=cli.parse_args()
    with open(args.session,encoding="utf-8") as f:
        session=json.load(f)
    with open(args.assets,encoding="utf-8") as f:
        assets=json.load(f)
    print(json.dumps(render_dry_stem_set(session,assets,Path(args.audio_root),
                                          Path(args.output_dir)),indent=2))
