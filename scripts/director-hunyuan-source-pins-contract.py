#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PINS=ROOT/"scripts/director-hunyuan-source-pins.sh"
RUNPOD=ROOT/"scripts/director-hunyuan-runpod-bootstrap.sh"
LAMBDA=ROOT/"scripts/director-hunyuan-lambda-bootstrap.sh"

pins=PINS.read_text()
runpod=RUNPOD.read_text()
lambda_=LAMBDA.read_text()

required_revision_vars=(
    "DIRECTOR_HUNYUAN_CODE_REVISION",
    "DIRECTOR_HUNYUAN_MODEL_REVISION",
    "DIRECTOR_HUNYUAN_QWEN_REVISION",
    "DIRECTOR_HUNYUAN_BYT5_REVISION",
    "DIRECTOR_HUNYUAN_GLYPH_REVISION",
    "DIRECTOR_HUNYUAN_SIGLIP_REVISION",
)
for name in required_revision_vars:
    match=re.search(rf"readonly {name}='([0-9a-f]{{40}})'",pins)
    if not match:
        raise SystemExit(f"DIRECTOR_HUNYUAN_PIN_INVALID:{name}")

for path,text in ((RUNPOD,runpod),(LAMBDA,lambda_)):
    if 'source "$SCRIPT_DIR/director-hunyuan-source-pins.sh"' not in text:
        raise SystemExit(f"DIRECTOR_HUNYUAN_PINS_NOT_SOURCED:{path.name}")
    if "modelscope download" in text:
        raise SystemExit(f"DIRECTOR_HUNYUAN_MOVING_MODELSCOPE_SOURCE_FORBIDDEN:{path.name}")
    required_downloads=(
        ('"$DIRECTOR_HUNYUAN_MODEL_SOURCE"','"$DIRECTOR_HUNYUAN_MODEL_REVISION"'),
        ('"$DIRECTOR_HUNYUAN_QWEN_SOURCE"','"$DIRECTOR_HUNYUAN_QWEN_REVISION"'),
        ('"$DIRECTOR_HUNYUAN_BYT5_SOURCE"','"$DIRECTOR_HUNYUAN_BYT5_REVISION"'),
        ('"$DIRECTOR_HUNYUAN_GLYPH_SOURCE"','"$DIRECTOR_HUNYUAN_GLYPH_REVISION"'),
    )
    for source,revision in required_downloads:
        expected=f"hf download {source} --revision {revision}"
        if expected not in text:
            raise SystemExit(f"DIRECTOR_HUNYUAN_UNPINNED_HF_DOWNLOAD:{path.name}:{source}")
    if 'git -C "$ROOT/HunyuanVideo-1.5" checkout --detach --force "$DIRECTOR_HUNYUAN_CODE_REVISION"' not in text:
        raise SystemExit(f"DIRECTOR_HUNYUAN_CODE_NOT_PINNED:{path.name}")
    if "DIRECTOR_RUNTIME_SOURCES.json" not in text:
        raise SystemExit(f"DIRECTOR_HUNYUAN_SOURCE_MANIFEST_MISSING:{path.name}")

if "Alptekinege/Glyph-SDXL-v2" not in pins:
    raise SystemExit("DIRECTOR_HUNYUAN_GLYPH_IMMUTABLE_MIRROR_MISSING")

print("DIRECTOR_HUNYUAN_SOURCE_PINS_CONTRACT_PASS")
