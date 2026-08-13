# Hoodie GLB Audit — tmpcaw3exi0.glb → hoodie.glb

A ChatGPT transcript was pasted in with a "first-pass audit" of this file,
but that same message admitted it no longer had access to the actual file.
Rather than trust those numbers, this is an independent audit — parsing the
GLB manually (no `pygltflib`/`trimesh` available offline, so this reads the
binary glTF format directly: 12-byte header, JSON chunk, BIN chunk) and
checking the geometry against the real buffers, not just structural claims.

## What checked out exactly as claimed

| Check | Claimed | Verified |
|---|---|---|
| Valid GLB | ✅ | ✅ confirmed — valid glTF 2.0 binary |
| Meshes | 1 | ✅ 1 |
| Vertices | 12,303 | ✅ 12,303 (POSITION accessor) |
| Triangles | 21,044 | ✅ 21,044 (63,132 indices ÷ 3) |
| UV coordinates | ✅ | ✅ TEXCOORD_0 present |
| Vertex normals | ✅ | ✅ NORMAL present |
| Base-color texture | 1024×1024 | ✅ confirmed by parsing the actual JPEG header |
| Normal map | 1024×1024 | ✅ confirmed by parsing the actual JPEG header |
| Roughness | ~0.209 | ✅ 0.2087 |
| Metallic | ~0.006 | ✅ 0.0064 |
| Watertight | ❌ | ✅ confirmed not watertight — 3,362 boundary (open) edges |
| Dimensions | 0.75 × 0.90 × 0.25 | ✅ confirmed from POSITION accessor min/max |

## What was wrong or incomplete

**"407 disconnected components" — flagged as the biggest concern. This was
misleading.** Counting connected components by shared vertex *index* gives
291 here (not even 407 — a discrepancy with the original claim on top of
everything else). But that number is an artifact: every hard UV seam in a
textured mesh requires the vertex to be duplicated (same position,
different UV), which breaks index-based connectivity without meaning the
surface is actually fragmented. Re-checked by welding vertices that share a
position: **the mesh is a single connected surface.** This is normal for
any UV-mapped model, not a fragmentation problem. Treating it as "the
biggest concern" would have sent this file back for cleanup it didn't need.

**"Degenerate triangles: 0" — incomplete.** That check only caught
triangles with a literally repeated vertex index. Checking actual
geometric area (cross product of the edges) found **4 zero-area
triangles** — real degenerate geometry the index-only check missed. Minor
at this scale (4 out of 21,044), not a blocker, but worth being accurate
about.

## What the transcript didn't do: actual visual QA

Rendered the mesh from front/back/side/top (`docs/asset-audits/glb_*.png`,
flat-shaded from real face normals, not a screenshot from a live renderer —
still enough to judge silhouette and topology). This is where the useful
finding is:

- **It's a genuine hoodie** — the top-down render clearly shows a collar,
  two sleeves with cuffs, and a ribbed hem. Not a placeholder blob.
- **It's oriented lying flat**, not standing upright. The mesh's own
  coordinate space has it lying in the X-Y plane (Stable Fast 3D's
  Z-up-ish export convention) rather than the Y-up "standing" orientation
  glTF viewers expect. `config/product3dModels.ts` applies a corrective
  `modelRotation: [-Math.PI/2, 0, 0]` — this is a first-pass estimate from
  the static renders, not confirmed in an actual Three.js session (no
  browser available in the sandbox that built this). **Verify this
  visually before trusting it** — if it's off, it's a sign-or-axis
  adjustment to that one rotation value, not a bigger problem.

## Verdict

**Usable for a web/WebGL preview as-is.** Not watertight and has a few
zero-area triangles, but per the transcript's own (correct) point: that
matters for manufacturing or 3D printing, not for a visual storefront
preview. The "407 fragments" alarm was the one piece of the original audit
that would have wrongly held this back.

**Not yet confirmed for actual display** — the rotation and the chest
print-area placement are estimates. First real thing to check once this
runs in a browser: does it stand upright correctly, and does the front
decal land on the chest instead of, say, a sleeve.
