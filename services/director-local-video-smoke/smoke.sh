#!/usr/bin/env bash
# Zero-provider-call MP4 codec/ffprobe smoke. NOT a ComfyUI or OpenMontage
# generation/agent runtime proof. Intended only for local renderer validation.
set -euo pipefail
command -v ffmpeg >/dev/null || { echo "FFMPEG_REQUIRED" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "FFPROBE_REQUIRED" >&2; exit 1; }
out="${1:-/tmp/jhadina-free-local-video-smoke.mp4}"
mkdir -p "$(dirname "$out")"
ffmpeg -nostdin -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=size=720x1280:rate=24:duration=4' \
  -f lavfi -i 'sine=frequency=220:sample_rate=48000:duration=4' \
  -c:v libx264 -preset ultrafast -crf 32 -pix_fmt yuv420p \
  -c:a aac -b:a 64k -t 4 -movflags +faststart "$out"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate \
  -of csv=p=0 "$out" | grep -qx 'h264,720,1280,24/1'
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name \
  -of csv=p=0 "$out" | grep -qx 'aac'
ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" | awk '{if ($1 < 3.9 || $1 > 4.1) exit 1}'
sha256sum "$out"
printf 'LOCAL_FFMPEG_MP4_SMOKE_PASS=%s\n' "$out"
printf 'NOTE=No OpenMontage agent, hosted API, diffusion/GPU generation, visual quality or commercial licensing was certified.\n'
