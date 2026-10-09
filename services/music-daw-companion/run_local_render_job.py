"""Child process for explicitly approved user-installed VST/AU effect rendering.

The companion supervisor enforces the timeout. No browser-supplied paths
are used to choose a plugin. Must not run from a public HTTP interface.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import sys
from native_effect_render import render_native_effect

if __name__ == "__main__":
    if len(sys.argv)!=5:
        raise SystemExit(2)
    source, digest, plugin, output = sys.argv[1:]
    secret=os.environ.get("MUSIC_DAW_COMPANION_TOKEN","")
    try:
        receipt=render_native_effect(Path(source),digest,plugin,Path(output),True,secret)
        print(json.dumps(receipt,sort_keys=True))
    except Exception:
        # Do not leak private plugin file paths or native plugin exception traces
        # to the remotely triggered browser.
        raise SystemExit(3)
