# PupsonStuff 3D Asset Audit Pipeline

## Running it

```bash
python3 scripts/audit_glb.py <path-to-glb> <asset-id> <category>
```

Needs `numpy` and `matplotlib`. No offline glTF library (`pygltflib`,
`trimesh`) was available to build this against — it parses the binary
glTF 2.0 container directly (12-byte header, JSON chunk, BIN chunk). That
covers everything both real assets here actually use (single mesh, single
material, embedded JPEG textures, no animation, no skinning). A more
exotic asset — multi-mesh, compressed (Draco/Meshopt), animated — would
need the script extended or a real glTF library installed.

## What it produces

```
asset-audits/
├── reports/<asset-id>.json   — full technical audit (Task 1)
├── renders/<asset-id>_*.png  — front/back/side/top/perspective (Task 2)
└── scores/<asset-id>.json    — technical score + status + drafted config (Task 3+4)

assets/
├── approved/       — passed the pipeline
└── needs-review/   — flagged, not yet fixed
```

## What's real vs. what's not

**Automated and real:**
- Every geometry/material check (vertex/triangle counts, UV/normal
  presence, degenerate triangles by actual area not just repeated
  indices, connected components — both the naive index-based count AND
  the physically-meaningful welded-position count, watertightness,
  texture resolution read from the actual embedded image bytes).
- The technical score and APPROVED/NEEDS_FIXES/REJECTED status are
  computed from those real checks, not guessed.
- The drafted Product3DEngine config pulls real values where it can
  (mesh/material names — correctly resolved from the *node* name, not
  the raw mesh name, which the shirt asset proved can differ and would
  silently break the engine's lookup if done wrong; camera distance from
  the actual bounding box).

**Explicitly NOT automated, on purpose:**
- **Visual score.** There's no honest way to algorithmically judge "does
  this look like a believable hoodie" from vertex data. The `visualScore`
  field is a real written assessment from actually looking at the
  rendered PNGs, not a fabricated number.
- **Rotation and print-zone placement in the drafted config.** Always
  marked `NEEDS_REVIEW`. A script can't confirm a decal lands on the
  chest instead of a sleeve — that needs the asset live in the actual
  Three.js renderer (the roadmap's own "Phase 1: browser validation").

## A real bug this caught in its own first draft

The first version of `draft_config()` pulled `meshName` from the mesh's
own `name` field. Running it against the shirt asset caught the actual
problem: the shirt's mesh is named `"Mesh"` (generic), but the *node*
that references it is named `"T_Shirt_male"` — and `@react-three/drei`'s
`useGLTF` exposes `nodes` keyed by node name, not mesh name. A config
built from the raw mesh name would have looked up `nodes.Mesh`, found
nothing, and failed to render. Fixed by resolving the node name that
references the mesh instead. Worth knowing if this pipeline gets extended
or ported — it's an easy mistake to make again.

## Results so far

| Asset | Technical Score | Status |
|---|---|---|
| hoodie | 99.8/100 | APPROVED |
| shirt | 100/100 | APPROVED |

Both under `assets/approved/`. Full reports/renders/scores for each are in
`asset-audits/`.

## "Test against 3 additional asset categories" — honestly, can't yet

There are exactly two real .glb files anywhere in this project: the shirt
and the hoodie. No mug, shoe, or other category asset has been uploaded.
Rather than fabricate results for categories that don't exist, this ran
against every real asset available. To actually test 3 more categories,
upload 3 more real .glb files — the pipeline will run against whatever's
given.
