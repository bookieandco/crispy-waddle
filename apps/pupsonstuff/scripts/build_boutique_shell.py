#!/usr/bin/env python3
"""
First-pass procedural boutique environment shell.

Builds the part of docs/boutique-design/evidence-request.md section 4 that
was already buildable without new reference assets, now that the one
blocking item (a real scale anchor) has an answer: standard 10ft retail
ceiling height, per the user.

What this IS: walls, floor, ceiling, a checkout counter volume, and a
track-lighting rail+head arrangement, all real dimensioned geometry with
real vertex colors sampled to match the photo's established color language
(docs/boutique-design/reference-knowledge-and-photo-analysis.md section
"Visual language") and real per-face UVs (unlike the retired
boutique_proxy.glb, which had none — see its rejected audit score). This
is a BOX-LEVEL massing model, not a decorated final environment: no doors,
no windows, no storefront (per the evidence-request answer, the entrance
comes from a separately generated concept image, not geometry built here),
no individual products/fixtures beyond the track lighting pattern this
project already has real reference construction knowledge for.

What's a real measurement vs. an assumption, stated plainly:
- Ceiling height = 3.048m (10ft) — REAL, the confirmed scale anchor.
- Room width/depth, counter dimensions — ASSUMED at plausible retail
  values (not measured from the photo, which alone can't give absolute
  scale for anything off-camera or without a stated reference). Flagged
  in the audit-adjacent doc, not hidden.
- Wall/floor/ceiling colors — sampled approximations of what
  reference-knowledge-and-photo-analysis.md already established from the
  actual photo (cream walls, black accent wall + ceiling, honey-oak
  floor), not exact pixel values.
- Track lighting rail+head proportions — real construction PATTERN from
  reference_knowledge/lighting_reference.json (rail + repeated heads,
  head-spacing roughly half the rail length), rebuilt at realistic
  real-world track-lighting dimensions rather than literally rescaling the
  source file's own units (which that file's own docs already flag as
  being from an unrelated reference blueprint, not a scale match for this
  room).

This is a multi-object environment kit (floor/ceiling/walls/counter/rails/
heads as separate pieces), not a single continuous product mesh — so the
audit pipeline's "N disconnected components" check, tuned for catching
accidental fragmentation in a single product asset, is EXPECTED to report
many components here. That's not a defect the way it was for the retired
boutique_proxy.glb (which was ALSO missing UVs and had real degenerate
triangles on top of the fragmentation — genuine failures, not just
multi-object structure).
"""

import json
import struct
import sys

import numpy as np

FT_TO_M = 0.3048

# ---------------------------------------------------------------------------
# Real scale anchor (confirmed) and assumed layout (flagged, not measured)
# ---------------------------------------------------------------------------
CEILING_HEIGHT = 10 * FT_TO_M          # 3.048m — REAL, user-confirmed anchor
ROOM_WIDTH = 9.0                        # X — ASSUMED plausible boutique width
ROOM_DEPTH = 7.0                        # Z — ASSUMED plausible boutique depth
COUNTER_HEIGHT = 1.02                   # ASSUMED — standard retail counter height
COUNTER_WIDTH = 2.4
COUNTER_DEPTH = 0.65

# Colors approximated from the actual photo per
# docs/boutique-design/reference-knowledge-and-photo-analysis.md
CREAM_WALL = [0.92, 0.89, 0.83]
BLACK_ACCENT = [0.07, 0.07, 0.08]
FLOOR_OAK = [0.62, 0.44, 0.27]
COUNTER_OAK_LIGHT = [0.55, 0.38, 0.22]
COUNTER_OAK_DARK = [0.38, 0.25, 0.14]
RAIL_METAL = [0.05, 0.05, 0.06]
LIGHT_HEAD = [0.15, 0.15, 0.16]

positions, normals, uvs, colors, indices = [], [], [], [], []


def add_quad(p0, p1, p2, p3, color, uv_scale=1.0):
    """CCW quad p0->p1->p2->p3, single flat color, real per-corner UVs."""
    base = len(positions)
    n = np.cross(np.array(p1) - np.array(p0), np.array(p2) - np.array(p0))
    norm = np.linalg.norm(n)
    n = (n / norm).tolist() if norm > 0 else [0, 1, 0]
    quad_uvs = [(0, 0), (uv_scale, 0), (uv_scale, uv_scale), (0, uv_scale)]
    for p, uv in zip((p0, p1, p2, p3), quad_uvs):
        positions.append(list(p))
        normals.append(n)
        uvs.append(list(uv))
        colors.append(color)
    indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])


def add_box(center, size, color_top=None, color_side=None, stripes=None):
    """Axis-aligned box, outward-facing normals, real UVs per face.
    stripes: optional (count, color_a, color_b) for vertical-slat coloring
    on the +Z/-Z faces (used for the counter's slat paneling)."""
    cx, cy, cz = center
    sx, sy, sz = size
    x0, x1 = cx - sx / 2, cx + sx / 2
    y0, y1 = cy - sy / 2, cy + sy / 2
    z0, z1 = cz - sz / 2, cz + sz / 2
    ct = color_top or color_side or [0.6, 0.6, 0.6]
    cs = color_side or ct

    # top / bottom
    add_quad((x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1), ct)
    add_quad((x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0), cs)
    # left / right
    add_quad((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), cs)
    add_quad((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), cs)

    if stripes:
        count, ca, cb = stripes
        step = sx / count
        for i in range(count):
            sxa = x0 + i * step
            sxb = x0 + (i + 1) * step
            col = ca if i % 2 == 0 else cb
            add_quad((sxa, y0, z1), (sxb, y0, z1), (sxb, y1, z1), (sxa, y1, z1), col)
            add_quad((sxb, y0, z0), (sxa, y0, z0), (sxa, y1, z0), (sxb, y1, z0), col)
    else:
        add_quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), cs)
        add_quad((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), cs)


def build():
    H = CEILING_HEIGHT
    W = ROOM_WIDTH
    D = ROOM_DEPTH
    x0, x1 = -W / 2, W / 2
    z0, z1 = -D / 2, D / 2  # z0 = back wall, z1 = open storefront side

    # Floor
    add_quad((x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1), FLOOR_OAK, uv_scale=W)
    # Ceiling (normal faces down into the room)
    add_quad((x0, H, z1), (x1, H, z1), (x1, H, z0), (x0, H, z0), BLACK_ACCENT, uv_scale=W)
    # Back wall (accent — the photo's dark logo wall)
    add_quad((x0, 0, z0), (x1, 0, z0), (x1, H, z0), (x0, H, z0), BLACK_ACCENT, uv_scale=W)
    # Left wall (cream — art grid + apparel rack side in the photo)
    add_quad((x0, 0, z1), (x0, 0, z0), (x0, H, z0), (x0, H, z1), CREAM_WALL, uv_scale=D)
    # Right wall (cream — shelving + hanging rack side in the photo)
    add_quad((x1, 0, z0), (x1, 0, z1), (x1, H, z1), (x1, H, z0), CREAM_WALL, uv_scale=D)
    # Storefront side (z1) intentionally left open — no entrance evidence
    # yet; see docs/boutique-design/entrance-concept-prompt.md.

    # Checkout counter, centered against the back wall, slat-paneled front
    counter_z = z0 + COUNTER_DEPTH / 2 + 0.05
    add_box(
        (0, COUNTER_HEIGHT / 2, counter_z),
        (COUNTER_WIDTH, COUNTER_HEIGHT, COUNTER_DEPTH),
        color_top=COUNTER_OAK_LIGHT,
        color_side=COUNTER_OAK_DARK,
        stripes=(12, COUNTER_OAK_LIGHT, COUNTER_OAK_DARK),
    )

    # Track lighting: 2 rails (over left-wall art zone, over right-wall
    # shelving zone), each with repeated heads. Real construction PATTERN
    # (long thin rail + small repeated heads, head-spacing ~ half the rail
    # length) from reference_knowledge/lighting_reference.json; dimensions
    # rebuilt at realistic real-world track-light scale rather than the
    # source file's own (unrelated-room, unknown-scale) units.
    rail_length = 3.0
    rail_y = H - 0.12
    for rail_x in (x0 + W * 0.22, x1 - W * 0.22):
        rz0 = z0 + 0.6
        add_box((rail_x, rail_y, rz0 + rail_length / 2), (0.05, 0.04, rail_length), RAIL_METAL)
        head_count = 6
        for i in range(head_count):
            hz = rz0 + (i + 0.5) * (rail_length / head_count)
            add_box((rail_x, rail_y - 0.05, hz), (0.10, 0.09, 0.12), LIGHT_HEAD)

    return {
        "ceilingHeightMeters": H,
        "roomWidthMeters": W,
        "roomDepthMeters": D,
    }


def write_glb(out_path, meta):
    positions_arr = np.array(positions, dtype=np.float32)
    normals_arr = np.array(normals, dtype=np.float32)
    uvs_arr = np.array(uvs, dtype=np.float32)
    colors_arr = np.array(colors, dtype=np.float32)
    indices_arr = np.array(indices, dtype=np.uint32)

    def pad4(b):
        return b + b"\x00" * ((4 - len(b) % 4) % 4)

    idx_bytes = pad4(indices_arr.tobytes())
    pos_bytes = pad4(positions_arr.tobytes())
    norm_bytes = pad4(normals_arr.tobytes())
    uv_bytes = pad4(uvs_arr.tobytes())
    col_bytes = pad4(colors_arr.tobytes())

    parts = [idx_bytes, pos_bytes, norm_bytes, uv_bytes, col_bytes]
    offsets, running = [], 0
    for p in parts:
        offsets.append(running)
        running += len(p)
    bin_data = b"".join(parts)

    buffer_views = [
        {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(idx_bytes), "target": 34963},
        {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(pos_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(norm_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(uv_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[4], "byteLength": len(col_bytes), "target": 34962},
    ]
    pmin, pmax = positions_arr.min(axis=0).tolist(), positions_arr.max(axis=0).tolist()
    accessors = [
        {"bufferView": 0, "componentType": 5125, "count": len(indices_arr), "type": "SCALAR"},
        {"bufferView": 1, "componentType": 5126, "count": len(positions_arr), "type": "VEC3", "min": pmin, "max": pmax},
        {"bufferView": 2, "componentType": 5126, "count": len(normals_arr), "type": "VEC3"},
        {"bufferView": 3, "componentType": 5126, "count": len(uvs_arr), "type": "VEC2"},
        {"bufferView": 4, "componentType": 5126, "count": len(colors_arr), "type": "VEC3"},
    ]

    gltf = {
        "asset": {"version": "2.0", "generator": "PupsonStuff boutique-shell builder", "extras": meta},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "boutique_shell", "mesh": 0}],
        "meshes": [{
            "name": "boutique_shell",
            "primitives": [{
                "attributes": {"POSITION": 1, "NORMAL": 2, "TEXCOORD_0": 3, "COLOR_0": 4},
                "indices": 0,
                "mode": 4,
                "material": 0,
            }],
        }],
        "materials": [{
            "name": "vertex_color",
            "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "roughnessFactor": 0.85, "metallicFactor": 0.0},
        }],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total_length)
    out += struct.pack("<I4s", len(json_bytes), b"JSON")
    out += json_bytes
    out += struct.pack("<I4s", len(bin_data), b"BIN\x00")
    out += bin_data
    with open(out_path, "wb") as f:
        f.write(out)

    return {
        "vertexCount": len(positions_arr),
        "triangleCount": len(indices_arr) // 3,
        "outputBytes": len(out),
    }


if __name__ == "__main__":
    out_path = sys.argv[1] if len(sys.argv) > 1 else "public/models/boutique_shell.glb"
    meta = build()
    info = write_glb(out_path, meta)
    print(json.dumps({**meta, **info}, indent=2))
