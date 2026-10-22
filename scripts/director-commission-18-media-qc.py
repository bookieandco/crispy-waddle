#!/usr/bin/env python3
"""Independent technical MP4 probe for Director pilot, never creative/final-QC certification.

Does not inspect likeness rights, continuity, source identity, ownership, speech
authenticity, edit approval or Social authority. Does not write to Supabase.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def validate(path: Path, expected_sha256: str, minimum: float, maximum: float) -> dict:
    if not path.is_file() or path.is_symlink():
        raise ValueError("DIRECTOR_TECHNICAL_MEDIA_FILE_INVALID")
    file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    if len(expected_sha256) != 64 or file_hash != expected_sha256.lower():
        raise ValueError("DIRECTOR_TECHNICAL_MEDIA_SHA256_MISMATCH")
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,channels",
        "-of", "json", str(path)
    ], capture_output=True, text=True, check=True)
    media = json.loads(probe.stdout)
    streams = media.get("streams", [])
    vids = [s for s in streams if s.get("codec_type") == "video"]
    audios = [s for s in streams if s.get("codec_type") == "audio"]
    if len(vids) != 1 or len(audios) != 1:
        raise ValueError("DIRECTOR_TECHNICAL_MEDIA_STREAMS_INVALID")
    video, audio = vids[0], audios[0]
    duration = float(media["format"]["duration"])
    if not (minimum <= duration <= maximum):
        raise ValueError("DIRECTOR_TECHNICAL_MEDIA_DURATION_INVALID")
    width, height = int(video["width"]), int(video["height"])
    if width < 240 or height < 240 or width >= height:
        raise ValueError("DIRECTOR_TECHNICAL_MEDIA_PORTRAIT_INVALID")
    if video["codec_name"] != "h264" or audio["codec_name"] != "aac":
        raise ValueError("DIRECTOR_TECHNICAL_MEDIA_CODEC_INVALID")
    # Decode EVERY frame and audio packet rather than trusting codec metadata.
    subprocess.run([
        "ffmpeg", "-v", "error", "-xerror", "-nostdin", "-i", str(path),
        "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"
    ], capture_output=True, check=True, timeout=120)
    return {
        "schemaVersion": 1,
        "authority": "DIRECTOR_TECHNICAL_MEDIA_INSPECTION_ONLY",
        "fileName": path.name,
        "sha256": file_hash,
        "bytes": path.stat().st_size,
        "durationSeconds": duration,
        "video": {"codec": "h264", "width": width, "height": height,
                  "frameRate": video.get("r_frame_rate")},
        "audio": {"codec": "aac", "channels": audio.get("channels")},
        "fullDecodePassed": True,
        "technicalMediaPassed": True,
        "ownerProjectLinked": False,
        "independentCreativeQCCertified": False,
        "likenessAndMusicRightsVerified": False,
        "authenticatedIphoneProof": False,
        "canPublish": False,
        "canRunPaidProviders": False,
        "nextBoundary": "OWNER_AUTHORIZED_PROJECT_FINAL_QC_AND_DURABLE_READBACK_REQUIRED"
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--minimum", type=float, default=10)
    parser.add_argument("--maximum", type=float, default=30)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not (0 < args.minimum <= args.maximum <= 120):
        parser.error("valid duration limits required")
    try:
        report = validate(args.file, args.expected_sha256, args.minimum, args.maximum)
    except (ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        parser.exit(1, f"DIRECTOR_TECHNICAL_MEDIA_REJECTED:{error}\n")
    body = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        if args.output.exists():
            parser.error("never overwrite prior receipt")
        args.output.write_text(body)
    print(body, end="")


if __name__ == "__main__":
    main()
