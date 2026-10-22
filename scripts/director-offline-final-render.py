#!/usr/bin/env python3
"""Governed offline FFmpeg renderer: real media, hashes, probing, no cloud/spend/publish.
Run only with an explicitly exported canonical plan and local authorized source files.
No remote URI is accepted. A render receipt does NOT substitute for Director final QC.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SHA = re.compile(r"^(?:sha256:)?([0-9a-f]{64})$", re.I)
SAFE_ID = re.compile(r"^[a-zA-Z0-9_.:-]{1,180}$")
VALID_KINDS = {"video", "audio"}

def fail(code: str) -> None:
    raise ValueError(code)

def finite_number(value: object, lower: float, upper: float, code: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        fail(code)
    number = float(value)
    if number < lower or number > upper:
        fail(code)
    return number

def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def metadata(path: Path) -> dict:
    proc = subprocess.run(["ffprobe", "-v", "error", "-show_format",
        "-show_streams", "-of", "json", str(path)], check=True,
        capture_output=True, text=True, timeout=60)
    return json.loads(proc.stdout)

def validated_plan(plan: dict, media_root: Path) -> tuple[dict, dict[str, tuple[Path, dict]]]:
    if plan.get("schemaVersion") != 1 or plan.get("authority") != "DIRECTOR_OFFLINE_RENDER_PLAN_ONLY":
        fail("DIRECTOR_RENDER_PLAN_AUTHORITY_INVALID")
    if plan.get("canPublish") is not False or plan.get("qcCertified") is not False:
        fail("DIRECTOR_RENDER_PLAN_ELEVATED_AUTHORITY")
    project = plan.get("projectId")
    if not isinstance(project, str) or not SAFE_ID.fullmatch(project):
        fail("DIRECTOR_RENDER_PROJECT_INVALID")
    revision = plan.get("timelineRevision")
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
        fail("DIRECTOR_RENDER_REVISION_INVALID")
    width, height, fps = (plan.get(k) for k in ("width", "height", "fps"))
    if any(not isinstance(v, int) or isinstance(v, bool) for v in (width, height, fps)):
        fail("DIRECTOR_RENDER_FRAME_INVALID")
    if min(width, height) < 16 or width * height > 4_000_000 or width % 2 or height % 2:
        fail("DIRECTOR_RENDER_FRAME_INVALID")
    if not 24 <= fps <= 60:
        fail("DIRECTOR_RENDER_FPS_INVALID")
    duration = finite_number(plan.get("durationSeconds"), 1, 120, "DIRECTOR_RENDER_DURATION_INVALID")
    sources = plan.get("sources")
    clips = plan.get("clips")
    if not isinstance(sources, list) or not isinstance(clips, list) or not clips:
        fail("DIRECTOR_RENDER_SOURCES_REQUIRED")
    root = media_root.resolve(strict=True)
    source_map: dict[str, tuple[Path, dict]] = {}
    for source in sources:
        if not isinstance(source, dict) or source.get("mediaType") not in VALID_KINDS:
            fail("DIRECTOR_RENDER_SOURCE_INVALID")
        ident, relative = source.get("assetId"), source.get("objectPath")
        if not isinstance(ident, str) or not SAFE_ID.fullmatch(ident) or ident in source_map:
            fail("DIRECTOR_RENDER_SOURCE_ID_INVALID")
        if not isinstance(relative, str) or not relative or relative.startswith("/") or "\\" in relative or "?" in relative or "#" in relative:
            fail("DIRECTOR_RENDER_SOURCE_PATH_INVALID")
        if any(part in (".", "..", "") for part in relative.split("/")):
            fail("DIRECTOR_RENDER_SOURCE_PATH_INVALID")
        local = (root / relative).resolve(strict=True)
        if not local.is_file() or not local.is_relative_to(root):
            fail("DIRECTOR_RENDER_SOURCE_OUTSIDE_ROOT")
        expected = SHA.fullmatch(str(source.get("sha256", "")))
        if not expected or digest(local) != expected.group(1).lower():
            fail("DIRECTOR_RENDER_SOURCE_HASH_MISMATCH")
        info = metadata(local)
        streams = info.get("streams", [])
        if not any(x.get("codec_type") == source["mediaType"] for x in streams):
            fail("DIRECTOR_RENDER_SOURCE_STREAM_MISSING")
        source_map[ident] = (local, info)
    last_video_end = 0.0
    has_video = False
    seen_clips: set[str] = set()
    for clip in clips:
        if not isinstance(clip, dict):
            fail("DIRECTOR_RENDER_CLIP_INVALID")
        ident = clip.get("clipId")
        if not isinstance(ident, str) or ident in seen_clips or not SAFE_ID.fullmatch(ident):
            fail("DIRECTOR_RENDER_CLIP_ID_INVALID")
        seen_clips.add(ident)
        aid, kind = clip.get("assetId"), clip.get("kind")
        if aid not in source_map or kind not in VALID_KINDS:
            fail("DIRECTOR_RENDER_CLIP_SOURCE_INVALID")
        source = next(s for s in sources if s["assetId"] == aid)
        if kind != source["mediaType"]:
            fail("DIRECTOR_RENDER_CLIP_SOURCE_KIND_MISMATCH")
        start = finite_number(clip.get("startSeconds"), 0, duration, "DIRECTOR_RENDER_CLIP_START_INVALID")
        length = finite_number(clip.get("durationSeconds"), 0.01, duration, "DIRECTOR_RENDER_CLIP_LENGTH_INVALID")
        offset = finite_number(clip.get("sourceInSeconds"), 0, 14400, "DIRECTOR_RENDER_CLIP_SOURCE_IN_INVALID")
        finite_number(clip.get("volume"), 0, 1, "DIRECTOR_RENDER_CLIP_VOLUME_INVALID")
        if start + length > duration + 0.001:
            fail("DIRECTOR_RENDER_CLIP_OUTSIDE_TIMELINE")
        source_duration = float(source_map[aid][1].get("format", {}).get("duration", 0))
        if not math.isfinite(source_duration) or source_duration + 0.12 < offset + length:
            fail("DIRECTOR_RENDER_CLIP_EXCEEDS_SOURCE")
        if kind == "video":
            has_video = True
            if start < last_video_end - 0.001:
                fail("DIRECTOR_RENDER_OVERLAPPING_VIDEO_UNSUPPORTED")
            last_video_end = start + length
    if not has_video:
        fail("DIRECTOR_RENDER_VIDEO_REQUIRED")
    return plan, source_map

def build_args(plan: dict, source_map: dict[str, tuple[Path, dict]], target: Path) -> list[str]:
    width, height, fps = (int(plan[k]) for k in ("width", "height", "fps"))
    dur = float(plan["durationSeconds"])
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}:d={dur:.4f}",
        "-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate=48000:d={dur:.4f}"]
    source_index = {}
    for i, (aid, (source, _)) in enumerate(source_map.items(), start=2):
        args.extend(["-i", str(source)])
        source_index[aid] = i
    filters = ["[0:v]format=yuv420p[bg0]"]
    background = "bg0"
    audio_tracks = ["[1:a]atrim=duration=" + str(dur) + ",asetpts=PTS-STARTPTS[silence]"]
    mixes = ["[silence]"]
    num_video = 0
    num_audio = 0
    for clip in plan["clips"]:
        asset = clip["assetId"]
        i = source_index[asset]
        start, source_in, length = (float(clip[k]) for k in
                                     ("startSeconds", "sourceInSeconds", "durationSeconds"))
        if clip["kind"] == "video":
            num_video += 1
            vlabel = f"v{num_video}"
            output = f"bg{num_video}"
            filters.append(
                f"[{i}:v:0]trim=start={source_in}:duration={length},"
                f"setpts=PTS-STARTPTS,scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,fps={fps},"
                f"format=yuv420p,setpts=PTS+{start}/TB[{vlabel}]")
            filters.append(
                f"[{background}][{vlabel}]overlay=eof_action=pass:shortest=0:"
                f"enable='between(t,{start},{start+length-1/fps})'[{output}]")
            background = output
        contains_audio = any(s.get("codec_type") == "audio" for s in source_map[asset][1]["streams"])
        if contains_audio:
            num_audio += 1
            label = f"a{num_audio}"
            delay = round(start * 1000)
            volume = float(clip["volume"])
            audio_tracks.append(
                f"[{i}:a:0]atrim=start={source_in}:duration={length},"
                f"asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,"
                f"volume={volume},adelay={delay}:all=1[{label}]")
            mixes.append(f"[{label}]")
    filters.extend(audio_tracks)
    filters.append("".join(mixes) +
                   f"amix=inputs={len(mixes)}:duration=first:dropout_transition=0:"
                   f"normalize=0,atrim=duration={dur}[aout]")
    args += ["-filter_complex", ";".join(filters), "-map", f"[{background}]",
        "-map", "[aout]", "-t", str(dur),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", "-f", "mp4", str(target)]
    return args

def render(plan: dict, media_root: Path, output_dir: Path, execute: bool) -> dict:
    plan, sources = validated_plan(plan, media_root)
    name = re.sub(r"[^a-zA-Z0-9_.-]+", "-", plan["projectId"]).strip(".-")
    filename = f"{name}-r{plan['timelineRevision']}.mp4"
    if not name:
        fail("DIRECTOR_RENDER_OUTPUT_NAME_INVALID")
    outdir = output_dir.resolve()
    if not outdir.is_dir():
        fail("DIRECTOR_RENDER_OUTPUT_DIRECTORY_REQUIRED")
    output = outdir / filename
    if output.exists() or (outdir / (filename + ".receipt.json")).exists():
        fail("DIRECTOR_RENDER_OUTPUT_ALREADY_EXISTS")
    if not execute:
        return {"ok": True, "renderExecuted": False,
            "sourceCount": len(sources), "clipCount": len(plan["clips"]),
            "filename": filename, "authority": "DIRECTOR_OFFLINE_RENDER_PREFLIGHT_ONLY"}
    temp = outdir / (filename + ".partial.mp4")
    try:
        subprocess.run(build_args(plan, sources, temp), check=True,
                       capture_output=True, text=True, timeout=1800)
        inspected = metadata(temp)
        streams = inspected.get("streams", [])
        actual_duration = float(inspected.get("format", {}).get("duration", 0))
        if abs(actual_duration - float(plan["durationSeconds"])) > 0.25:
            fail("DIRECTOR_RENDER_OUTPUT_DURATION_MISMATCH")
        if not any(s.get("codec_type") == "video" and
           s.get("width") == plan["width"] and s.get("height") == plan["height"]
           for s in streams):
            fail("DIRECTOR_RENDER_OUTPUT_VIDEO_INVALID")
        if not any(s.get("codec_type") == "audio" for s in streams):
            fail("DIRECTOR_RENDER_OUTPUT_AUDIO_MISSING")
        output_sha = digest(temp)
        receipt = {
            "authority": "DIRECTOR_LOCAL_FFMPEG_EXECUTION_ONLY",
            "renderExecuted": True, "projectId": plan["projectId"],
            "timelineRevision": plan["timelineRevision"],
            "timelineVersionId": plan["timelineVersionId"],
            "durationSeconds": actual_duration,
            "width": plan["width"], "height": plan["height"], "fps": plan["fps"],
            "outputFile": filename, "outputSha256": output_sha,
            "sourceSha256": {id: digest(local) for id,(local,_) in sources.items()},
            "canPublish": False, "qcCertified": False, "costUsd": 0,
            "costBasis": "LOCAL_EXECUTION_NO_PROVIDER_BILLING_OBSERVED",
            "nextBoundary": "INDEPENDENT_DIRECTOR_FINAL_QC_AND_OWNER_REVIEW_REQUIRED",
        }
        temp.replace(output)
        receipt_file = outdir / (filename + ".receipt.json")
        with receipt_file.open("x", encoding="utf-8") as stream:
            json.dump(receipt, stream, indent=2, sort_keys=True)
        return receipt
    finally:
        if temp.exists():
            temp.unlink()

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--media-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--execute", action="store_true", help="Explicitly run local FFmpeg (never cloud)")
    args = parser.parse_args()
    if args.execute and not shutil.which("ffmpeg"):
        fail("DIRECTOR_RENDER_FFMPEG_REQUIRED")
    if not shutil.which("ffprobe"):
        fail("DIRECTOR_RENDER_FFPROBE_REQUIRED")
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    receipt = render(plan, args.media_root, args.output_dir, args.execute)
    print(json.dumps(receipt, sort_keys=True))

if __name__ == "__main__":
    main()
