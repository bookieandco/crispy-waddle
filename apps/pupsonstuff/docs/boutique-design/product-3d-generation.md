# Generating Missing Product 3D Assets via Image-to-3D

What `scripts/generate_3d_from_image.py` is for, and exactly what's
blocking it from having been run for real yet.

## The gap it fills

`config/product3dModels.ts` has a standing comment: *"Tote, canvas, etc.
still need their own real .glb before an entry here does anything."*
Today's real, audited, approved product meshes (shirt, hoodie, mug,
pillow) came from three different manual sources — a licensed open-source
mesh, a Stable Fast 3D output someone ran outside this codebase and
uploaded, and a manual OBJ→GLB conversion. `bottle` and `tote` have
neither a mesh nor a source for one.

This script is a fourth, repeatable source: a reference product photo in,
a raw `.glb` out, via a Hugging Face-hosted image-to-3D model (Stable Fast
3D by default — the same tool the hoodie already came from, just
scripted instead of manual). It does **not** replace
`scripts/audit_glb.py` — the output still goes through that exact same
audit gate as every other asset, real or generated, before anything gets
marked approved.

## What's real vs. not, stated plainly

- **The script itself**: real, imports cleanly, error-handles a missing
  input photo correctly (checked). `gradio_client` and `huggingface_hub`
  are installed and confirmed working in this environment.
- **Never actually run end-to-end.** Two separate real blockers, not one
  vague "no API key":
  1. **No reference photo exists.** Checked the whole repo — `public/`,
     `assets/`, the boutique photo itself — nothing isolates a bottle or
     tote product shot. There's nothing to feed this script yet.
  2. **This sandbox's network policy blocks `huggingface.co` outright.**
     Not "no key configured" — confirmed via
     `curl $HTTPS_PROXY/__agentproxy/status`, which logs a real rejected
     request: `connect_rejected ... gateway answered 403 to CONNECT`,
     `host: huggingface.co:443`. Per this environment's own instructions,
     that's an organization policy denial, not something to route around
     or retry. Even with a real `HUGGINGFACE_API_KEY` set, this specific
     sandbox cannot reach Hugging Face at all right now. That's a
     stronger caveat than what `lib/ai.ts` (OpenAI) and
     `lib/animation.ts` (Hugging Face image-to-video) already carry —
     those are honestly "not exercised against a live key, no network
     access to test with in this sandbox"; this is "the destination is
     blocked at the network level regardless of key."
  3. Because of (2), `client.view_api()` was never able to run against
     the real Space to confirm its current parameter names. The
     `client.predict(..., api_name="/predict")` call in the script
     follows Stable Fast 3D's typical documented `gradio_client` usage,
     not a live-confirmed one. Gradio Space APIs do change — this needs
     checking against the live Space the first time it runs somewhere
     that can actually reach it, and the call adjusted if it's drifted.

## How to actually use this once both blockers are gone

1. Get a real product reference photo for the target product (a bottle,
   a tote — plain background, product-only, similar to how Stable Fast
   3D's own demo examples look) and save it somewhere in the repo, e.g.
   `product-photos/bottle.jpg` (not yet a convention — first real use
   establishes it).
2. `pip install gradio_client` (already confirmed working here).
3. `python3 scripts/generate_3d_from_image.py product-photos/bottle.jpg bottle`
   → writes `assets/needs-review/bottle.glb`.
4. `python3 scripts/audit_glb.py assets/needs-review/bottle.glb bottle drinkware-or-whatever-category`
   → the existing pipeline, unchanged. Move to `assets/approved/` only if
   it actually passes, same as every other asset.
5. Register it in `config/product3dModels.ts` (mesh/material names from
   the audit's drafted config, rotation/print-area marked `NEEDS_REVIEW`
   until confirmed live in a browser — same pattern as every model
   already there).
6. Add the hotspot→model mapping in `ProductModal.tsx`'s
   `HOTSPOT_3D_MODEL`.

None of steps 1–6 happened in this pass — this is the tool and the
documented path, not a claim that a bottle or tote model now exists.
