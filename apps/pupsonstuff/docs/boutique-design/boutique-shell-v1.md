# Boutique Shell — First-Pass Reconstruction

What `scripts/build_boutique_shell.py` actually produced, once MUST HAVE
items 1 and 3 from `evidence-request.md` had answers (item 2, the
entrance, is handled separately — see `entrance-concept-prompt.md` — and
deliberately left as an open gap in this geometry rather than guessed at).

## The two answers this was built from

- **Scale anchor**: 10ft (3.048m) standard retail ceiling height, per the
  user. Everything else in this shell is dimensioned relative to that —
  it's the one real measurement in the file.
- **Real vs. AI-generated**: confirmed AI-generated concept image, not a
  photographed real space (both from the user's answer and from a direct
  look at `public/boutique.png` itself — the ceiling's duct/track-lighting
  treatment, the mixed illustration styles on the wall art, and the total
  absence of any storefront in frame all read as generated-concept
  markers, not photographed-space markers). This matters because it means
  "more accuracy" for anything besides the ceiling height means new
  creative direction, not measurement — consistent with how the entrance
  is being handled.

## What's real measurement vs. assumption in this file, stated plainly

| Element | Value | Basis |
|---|---|---|
| Ceiling height | 3.048m | REAL — the confirmed anchor |
| Room width | 9.0m | ASSUMED — plausible boutique footprint, not derived from the photo (a single photo can't give absolute width without its own anchor) |
| Room depth | 7.0m | ASSUMED, same reasoning |
| Counter height | 1.02m | ASSUMED — standard retail counter height |
| Counter width/depth | 2.4m / 0.65m | ASSUMED — plausible proportions |
| Wall/floor/ceiling colors | cream / black accent / honey-oak | Approximated from the real photo analysis in `reference-knowledge-and-photo-analysis.md`, not exact sampled pixel values |
| Track lighting rail+head pattern | rail + repeated heads, ~half-rail-length spacing | Real construction PATTERN from `reference_knowledge/lighting_reference.json`, rebuilt at realistic real-world dimensions (that file's own source units are from an unrelated reference room at unknown/mismatched scale — reusing the pattern, not the literal numbers) |

If the width/depth/counter assumptions turn out wrong once there's a
second reference (evidence-request.md's NICE TO HAVE #4 — a second photo
angle), those are single-number changes at the top of the script, not a
rebuild.

## What's deliberately NOT in this shell

- **Storefront/entrance** — left as an open gap on the +Z side. Per the
  evidence-request answer, this comes from a generated concept image
  (`entrance-concept-prompt.md`), not procedural geometry guessed from
  nothing.
- **Individual furniture/fixtures** beyond the counter and track lighting
  — the display table, apparel racks, shelving, armchair, and wall-art
  frames all remain 2D hotspot elements on `public/boutique.png` for now;
  this shell is the architectural envelope only.
- **Textures** — vertex-colored flat surfaces, not materials/textures. Good
  enough to block out proportions and lighting placement; not final visual
  quality.

## Audit result and why its score reads the way it does

```
python3 scripts/audit_glb.py public/models/boutique_shell.glb boutique_shell environment
```

**70/100, NEEDS_FIXES** — the only deduction is "16 real disconnected
pieces." That's expected, not a defect: this is a multi-object environment
kit (floor, ceiling, 3 walls, counter, 2 light rails, 12 light heads — 19
distinct volumes, some of which share exact boundary vertices and weld
together, hence 16 not 19), not a single continuous product mesh. The
audit pipeline's disconnection check was built and tuned to catch
*accidental* fragmentation in what's supposed to be one coherent product
surface (that's exactly what it caught, correctly, in the retired
`boutique_proxy.glb` — see below). Applying the same numeric threshold to
an environment kit isn't the same kind of finding, which is why this
document exists instead of chasing the score to 100 by welding
architecturally-separate pieces into one mesh for no real reason.

What the audit did NOT flag, and is real: no missing UVs (unlike
`boutique_proxy.glb`), no zero-area triangles, no degenerate geometry —
every quad in this file is real, valid, axis-aligned box/plane geometry
with per-face planar UVs.

## Relationship to the retired `boutique_proxy.glb`

`public/models/boutique_proxy.glb` (REJECTED, 20/100 — missing UVs, 32
zero-area triangles, 217 disconnected pieces) was never actually a
boutique reconstruction attempt — per Milestone 5.6, it's a proxy built
from `scripts/build_proxy_from_blueprint.py` against the *unrelated*
reference blueprint's 231-object extraction (the same source
`reference_knowledge/` is built from), not from anything about
PupsonStuff's actual store. Its name is genuinely misleading; it's kept in
place because it's not wired into any component and isn't harmful sitting
there, but `boutique_shell.glb` (this file) is the actual first real
attempt at PupsonStuff's own environment, built from PupsonStuff's own
photo analysis and the user's own evidence answers — not from the
unrelated reference room.

## Not yet done

- Not wired into any component — `Boutique.tsx` still renders the flat
  `public/boutique.png` with 2D hotspots. Embedding this shell as an
  actual explorable 3D scene (vs. today's photo-plus-hotspots page) is a
  real architectural change to the app, not a drop-in swap, and is future
  milestone work, not implied by this file existing.
- Not confirmed live in a Three.js/drei viewer — same caveat as every
  other model in this project (matplotlib audit renders are a real check
  on geometry validity, not a substitute for seeing it rendered the way
  the actual app would).
