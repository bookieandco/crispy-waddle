#!/usr/bin/env python3
"""
Generates a raw product .glb from a reference product photo, via a
Hugging Face-hosted image-to-3D model (Stable Fast 3D by default — the
same tool this project's own hoodie.glb was already sourced from,
per Milestone 5.2's notes, just done manually outside this codebase
until now).

This is the missing FIRST step for the products that still have no real
mesh at all — per config/product3dModels.ts's own comment: "Tote, canvas,
etc. still need their own real .glb before an entry here does anything."
Candidates today: `bottle`, `tote` (canvas is flat wall art, doesn't need
a 3D mesh; shirt/hoodie/mug/pillow already have real ones).

Output feeds into the EXISTING pipeline, not a new one:
    python3 scripts/generate_3d_from_image.py <photo> <asset_id>
    python3 scripts/audit_glb.py assets/needs-review/<asset_id>.glb <asset_id> <category>
Same as every other asset source so far (the manual OBJ->GLB conversion,
the Stable-Fast-3D-sourced hoodie) — generation and audit are always two
separate steps, and nothing here bypasses the audit gate.

-----------------------------------------------------------------------
WHAT'S HONEST ABOUT THIS FILE, STATED PLAINLY:

- NOT run, even once, in this environment. Two separate real blockers,
  not one:
  1. No product reference photo exists anywhere in this repo for
     `bottle` or `tote` — there is nothing to actually feed this script
     yet. (`assets/`, `public/`, and the boutique photo itself were all
     checked; none contains an isolated bottle/tote product shot.)
  2. This sandbox's own egress policy blocks huggingface.co outright —
     confirmed via a real request that came back "403, policy denial"
     (checked with `curl $HTTPS_PROXY/__agentproxy/status`, which logs
     it as `connect_rejected ... gateway answered 403 to CONNECT`), not
     just "no API key configured" (the situation OPENAI_API_KEY and
     HUGGINGFACE_API_KEY were already honestly documented as being in
     for lib/ai.ts and lib/animation.ts). Even with a real HF token, THIS
     sandbox cannot reach Hugging Face at all right now — a stronger
     caveat than "untested," and a different one from those two files'.
- Because of the network block above, `client.view_api()` was never able
  to run against the real Space to confirm its current parameter names.
  The call below (`api_name="/predict"` or similar) follows Stable Fast
  3D's publicly documented/typical gradio_client usage pattern, not a
  live-confirmed one — Gradio Space APIs do change over time, and this
  is genuinely the kind of thing that needs checking against the live
  Space (`client.view_api()`) the first time this actually runs somewhere
  that can reach it.
- Requires `pip install gradio_client` (installed and confirmed working
  in this environment) and, for Spaces that rate-limit anonymous callers,
  a Hugging Face token via HUGGINGFACE_API_KEY (same env var
  lib/animation.ts already uses — one token for both).
"""

import os
import sys
import shutil


DEFAULT_SPACE = "stabilityai/stable-fast-3d"


def generate_glb(photo_path: str, asset_id: str, out_dir: str = "assets/needs-review",
                  space: str = DEFAULT_SPACE) -> str:
    try:
        from gradio_client import Client, handle_file
    except ImportError as e:
        raise SystemExit(
            "gradio_client is required: pip install gradio_client"
        ) from e

    if not os.path.isfile(photo_path):
        raise SystemExit(f"Reference photo not found: {photo_path}")

    token = os.environ.get("HUGGINGFACE_API_KEY") or None

    client = Client(space, hf_token=token)

    # NOT live-verified against the actual Space (see module docstring —
    # huggingface.co is blocked from this sandbox). Stable Fast 3D's
    # typical gradio_client call takes a single image input and returns a
    # path to a generated .glb; the exact api_name/positional-vs-keyword
    # shape should be confirmed with client.view_api() the first time this
    # runs somewhere with real network access, and this call adjusted to
    # match if it's drifted.
    result = client.predict(
        handle_file(photo_path),
        api_name="/predict",
    )

    # result shape also unconfirmed live — Stable Fast 3D's demo returns
    # either a direct file path or a dict/tuple containing one depending
    # on the Space version. Handle the common cases rather than assuming
    # one.
    generated_path = result
    if isinstance(result, (list, tuple)):
        generated_path = result[0]
    if isinstance(generated_path, dict):
        generated_path = generated_path.get("path") or generated_path.get("value")

    if not generated_path or not os.path.isfile(generated_path):
        raise SystemExit(
            f"Space call returned no usable file path (got: {result!r}). "
            "This is exactly the kind of drift the module docstring warns "
            "about — run client.view_api() against the live Space and fix "
            "the call above."
        )

    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, f"{asset_id}.glb")
    shutil.copy2(generated_path, dest)
    return dest


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <reference-photo> <asset-id> [space]")
        print(f"  e.g.: {sys.argv[0]} product-photos/bottle.jpg bottle")
        sys.exit(1)

    photo_path = sys.argv[1]
    asset_id = sys.argv[2]
    space = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_SPACE

    dest = generate_glb(photo_path, asset_id, space=space)
    print(f"Generated: {dest}")
    print(f"Next: python3 scripts/audit_glb.py {dest} {asset_id} <category>")
