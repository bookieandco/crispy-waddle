#!/usr/bin/env python3
"""
Removes zero-area triangles from a single-mesh, single-primitive GLB.

Built for the mug asset's specific NEEDS_FIXES finding (asset-audits/
scores/mug.json): 260 zero-area triangles with repeatedIndex == 0, i.e.
each bad triangle references 3 *distinct* vertex indices, but two of those
vertices sit at (or extremely near) the same position — a near-duplicate-
vertex situation in the source OBJ, not a triangulation artifact (the
milestone log already ruled that out: re-triangulating the source quads
along the other diagonal made no difference).

The fix here is the standard, safe one for that situation: drop triangles
whose computed area falls under the audit pipeline's own zero-area
threshold (1e-10, matching scripts/audit_glb.py's geometry_audit so a
re-run of the audit and this script agree on what counts as degenerate).
No vertices are removed or moved — only the index buffer shrinks. Since a
zero-area triangle contributes no visible surface and its vertices are
(within floating-point noise) coincident with a neighboring triangle's
vertices, removing it doesn't open a hole in the surrounding surface.

Usage:
    python3 scripts/fix_degenerate_triangles.py <in.glb> <out.glb>
"""

import sys
import os
import json
import struct

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from audit_glb import parse_glb, read_accessor  # reuse the exact same GLB parsing


ZERO_AREA_THRESHOLD = 1e-10  # must match audit_glb.py's geometry_audit


def pad4(b):
    return b + b"\x00" * ((4 - len(b) % 4) % 4)


def fix_glb(in_path, out_path):
    gltf, bin_chunk, _, version = parse_glb(in_path)

    mesh = gltf["meshes"][0]
    prim = mesh["primitives"][0]
    attrs = prim["attributes"]

    indices = read_accessor(gltf, bin_chunk, prim["indices"]).astype(np.uint32)
    positions = read_accessor(gltf, bin_chunk, attrs["POSITION"]).astype(np.float64)
    normals = read_accessor(gltf, bin_chunk, attrs["NORMAL"]) if "NORMAL" in attrs else None
    uvs = read_accessor(gltf, bin_chunk, attrs["TEXCOORD_0"]) if "TEXCOORD_0" in attrs else None

    triangles = indices.reshape(-1, 3)
    v0, v1, v2 = positions[triangles[:, 0]], positions[triangles[:, 1]], positions[triangles[:, 2]]
    cross = np.cross(v1 - v0, v2 - v0)
    areas = 0.5 * np.linalg.norm(cross, axis=1)

    keep = areas >= ZERO_AREA_THRESHOLD
    removed = int(np.sum(~keep))
    kept_triangles = triangles[keep]
    new_indices = kept_triangles.reshape(-1).astype(np.uint32)

    # Rebuild the binary chunk: indices first (matches the source file's
    # own layout), then the untouched vertex attribute arrays, each 4-byte
    # padded. No vertex is removed, moved, or renumbered -- only which
    # triangles reference them changes -- so POSITION/NORMAL/TEXCOORD_0
    # accessors keep their original counts and bounding box.
    idx_bytes = pad4(new_indices.astype(np.uint32).tobytes())
    pos_bytes = pad4(positions.astype(np.float32).tobytes())
    chunks = [("indices", idx_bytes, 34963)]
    if normals is not None:
        chunks.append(("normals", pad4(normals.astype(np.float32).tobytes()), 34962))
    if uvs is not None:
        chunks.append(("uvs", pad4(uvs.astype(np.float32).tobytes()), 34962))

    buffer_views = []
    offset = 0
    bv_index = {}
    # indices bufferView
    buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(idx_bytes), "target": 34963})
    bv_index["indices"] = 0
    offset += len(idx_bytes)
    # positions bufferView
    buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(pos_bytes), "target": 34962})
    bv_index["positions"] = len(buffer_views) - 1
    offset += len(pos_bytes)

    bin_parts = [idx_bytes, pos_bytes]
    accessors = [
        {"bufferView": bv_index["indices"], "componentType": 5125, "count": len(new_indices), "type": "SCALAR"},
        {
            "bufferView": bv_index["positions"], "componentType": 5126, "count": len(positions), "type": "VEC3",
            "min": positions.min(axis=0).tolist(), "max": positions.max(axis=0).tolist(),
        },
    ]
    attr_map = {"POSITION": 1}

    if normals is not None:
        n_bytes = pad4(normals.astype(np.float32).tobytes())
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(n_bytes), "target": 34962})
        bv_i = len(buffer_views) - 1
        offset += len(n_bytes)
        bin_parts.append(n_bytes)
        accessors.append({"bufferView": bv_i, "componentType": 5126, "count": len(normals), "type": "VEC3"})
        attr_map["NORMAL"] = len(accessors) - 1

    if uvs is not None:
        uv_bytes = pad4(uvs.astype(np.float32).tobytes())
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(uv_bytes), "target": 34962})
        bv_i = len(buffer_views) - 1
        offset += len(uv_bytes)
        bin_parts.append(uv_bytes)
        accessors.append({"bufferView": bv_i, "componentType": 5126, "count": len(uvs), "type": "VEC2"})
        attr_map["TEXCOORD_0"] = len(accessors) - 1

    bin_data = b"".join(bin_parts)

    new_gltf = dict(gltf)
    new_gltf["accessors"] = accessors
    new_gltf["bufferViews"] = buffer_views
    new_gltf["buffers"] = [{"byteLength": len(bin_data)}]
    new_gltf["meshes"][0]["primitives"][0] = {
        "attributes": attr_map,
        "indices": 0,
        "material": prim.get("material", 0),
        "mode": prim.get("mode", 4),
    }

    json_bytes = json.dumps(new_gltf, separators=(",", ":")).encode("utf-8")
    json_bytes = json_bytes + b" " * ((4 - len(json_bytes) % 4) % 4)

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
        "trianglesIn": len(triangles),
        "trianglesRemoved": removed,
        "trianglesOut": len(kept_triangles),
        "vertexCountUnchanged": len(positions),
        "outputBytes": len(out),
    }


if __name__ == "__main__":
    in_path, out_path = sys.argv[1], sys.argv[2]
    info = fix_glb(in_path, out_path)
    print(json.dumps(info, indent=2))
