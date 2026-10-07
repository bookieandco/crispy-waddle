#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PINS=ROOT/"scripts/director-human-media-source-pins.sh"
BOOTSTRAP=ROOT/"scripts/director-human-media-runpod-bootstrap.sh"

pins=PINS.read_text()
bootstrap=BOOTSTRAP.read_text() if BOOTSTRAP.exists() else ""

required_revision_vars=(
    "DIRECTOR_MUSETALK_CODE_REVISION",
    "DIRECTOR_MUSETALK_MODEL_REVISION",
    "DIRECTOR_MUSETALK_VAE_REVISION",
    "DIRECTOR_MUSETALK_WHISPER_REVISION",
    "DIRECTOR_MUSETALK_DWPOSE_REVISION",
)
for name in required_revision_vars:
    if not re.search(rf"readonly {name}='[0-9a-f]{{40}}'",pins):
        raise SystemExit(f"DIRECTOR_MUSETALK_PIN_INVALID:{name}")

if not bootstrap:
    raise SystemExit("DIRECTOR_MUSETALK_BOOTSTRAP_MISSING")
if 'source "$SCRIPT_DIR/director-human-media-source-pins.sh"' not in bootstrap:
    raise SystemExit("DIRECTOR_MUSETALK_PINS_NOT_SOURCED")
if 'git -C "$MUSE_REPO" checkout --detach --force "$DIRECTOR_MUSETALK_CODE_REVISION"' not in bootstrap:
    raise SystemExit("DIRECTOR_MUSETALK_CODE_NOT_PINNED")

for source,revision in (
    ('"$DIRECTOR_MUSETALK_MODEL_SOURCE"','"$DIRECTOR_MUSETALK_MODEL_REVISION"'),
    ('"$DIRECTOR_MUSETALK_VAE_SOURCE"','"$DIRECTOR_MUSETALK_VAE_REVISION"'),
    ('"$DIRECTOR_MUSETALK_WHISPER_SOURCE"','"$DIRECTOR_MUSETALK_WHISPER_REVISION"'),
    ('"$DIRECTOR_MUSETALK_DWPOSE_SOURCE"','"$DIRECTOR_MUSETALK_DWPOSE_REVISION"'),
):
    expected=f'hf download {source} --revision {revision}'
    if expected not in bootstrap:
        raise SystemExit(f"DIRECTOR_MUSETALK_UNPINNED_HF_DOWNLOAD:{source}")

for marker in (
    "DIRECTOR_RUNTIME_SOURCES.json",
    "DIRECTOR-HUMAN-MEDIA-MUSETALK-SOURCES-1",
    "DIRECTOR_HUMAN_MEDIA_IMAGE_DIGEST",
    "app:app --host 127.0.0.1 --port 8095",
):
    if marker not in bootstrap:
        raise SystemExit(f"DIRECTOR_MUSETALK_BOOTSTRAP_CONTRACT_MISSING:{marker}")

print("DIRECTOR_MUSETALK_SOURCE_PINS_CONTRACT_PASS")
