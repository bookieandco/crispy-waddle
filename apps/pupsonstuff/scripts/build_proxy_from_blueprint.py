#!/usr/bin/env python3
"""
Builds a mobile-safe proxy GLB from the streaming blueprint extraction
(scripts/extract_obj_blueprint.py output). One box per source object,
positioned and sized from its REAL measured bounding box, colored from its
REAL extracted material color where one was found (gray fallback where not).

This is explicitly a proxy, not a decimated copy of the real mesh geometry
-- a wall's actual shape becomes a box the size of its bounding box, not a
simplified version of its real silhouette. That's the tradeoff requested:
real measurements, simplified representation.
"""

import json
import struct
import sys
import numpy as np

BOX_TRIS = [
    (0,1,2),(0,2,3), (4,6,5),(4,7,6), (0,4,5),(0,5,1),
    (1,5,6),(1,6,2), (2,6,7),(2,7,3), (3,7,4),(3,4,0),
]

def box_corners(mn, mx):
    x0,y0,z0 = mn
    x1,y1,z1 = mx
    return [
        (x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
        (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1),
    ]

def face_normal(p0, p1, p2):
    v1 = np.array(p1) - np.array(p0)
    v2 = np.array(p2) - np.array(p0)
    n = np.cross(v1, v2)
    norm = np.linalg.norm(n)
    return (n / norm).tolist() if norm > 0 else [0, 0, 1]

def build_proxy_glb(blueprint_path, out_path, min_dimension=0.5, scale_factor=0.01):
    objects = json.load(open(blueprint_path))

    positions, normals, colors, indices = [], [], [], []
    included, skipped_tiny = 0, 0

    # 6 faces, each defined by 4 corner indices (from box_corners' 8-point order)
    FACES = [
        (0,1,2,3),  # bottom (z0)
        (4,5,6,7),  # top (z1) -- will get correct outward normal from CCW winding below
        (0,1,5,4),  # front
        (1,2,6,5),  # right
        (2,3,7,6),  # back
        (3,0,4,7),  # left
    ]

    for obj in objects:
        dims = obj["dimensions"]
        if max(dims) < min_dimension:
            skipped_tiny += 1
            continue

        mn = [v * scale_factor for v in obj["min"]]
        mx = [v * scale_factor for v in obj["max"]]
        corners = box_corners(mn, mx)

        color = obj.get("color")
        rgb = [c / 255.0 for c in color] if color else [0.6, 0.6, 0.6]

        for face in FACES:
            face_pts = [corners[i] for i in face]
            n = face_normal(face_pts[0], face_pts[1], face_pts[2])
            base_idx = len(positions)
            for p in face_pts:
                positions.append(p)
                normals.append(n)
                colors.append(rgb)
            indices.extend([base_idx, base_idx+1, base_idx+2, base_idx, base_idx+2, base_idx+3])
        included += 1

    positions_arr = np.array(positions, dtype=np.float32)
    normals_arr = np.array(normals, dtype=np.float32)
    colors_arr = np.array(colors, dtype=np.float32)
    indices_arr = np.array(indices, dtype=np.uint32)

    def pad4(b):
        return b + b"\x00" * ((4 - len(b) % 4) % 4)

    pos_bytes = pad4(positions_arr.tobytes())
    norm_bytes = pad4(normals_arr.tobytes())
    col_bytes = pad4(colors_arr.tobytes())
    idx_bytes = pad4(indices_arr.tobytes())

    bin_chunks = [idx_bytes, pos_bytes, norm_bytes, col_bytes]
    offsets, running = [], 0
    for c in bin_chunks:
        offsets.append(running)
        running += len(c)
    bin_data = b"".join(bin_chunks)

    buffer_views = [
        {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(idx_bytes), "target": 34963},
        {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(pos_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(norm_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(col_bytes), "target": 34962},
    ]
    pmin, pmax = positions_arr.min(axis=0).tolist(), positions_arr.max(axis=0).tolist()
    accessors = [
        {"bufferView": 0, "componentType": 5125, "count": len(indices_arr), "type": "SCALAR"},
        {"bufferView": 1, "componentType": 5126, "count": len(positions_arr), "type": "VEC3", "min": pmin, "max": pmax},
        {"bufferView": 2, "componentType": 5126, "count": len(normals_arr), "type": "VEC3"},
        {"bufferView": 3, "componentType": 5126, "count": len(colors_arr), "type": "VEC3"},
    ]

    gltf = {
        "asset": {"version": "2.0", "generator": "PupsonStuff blueprint-proxy builder"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "boutique_proxy", "mesh": 0}],
        "meshes": [{
            "name": "boutique_proxy",
            "primitives": [{
                "attributes": {"POSITION": 1, "NORMAL": 2, "COLOR_0": 3},
                "indices": 0,
                "mode": 4,
                "material": 0,
            }],
        }],
        "materials": [{
            "name": "vertex_color",
            "pbrMetallicRoughness": {"baseColorFactor": [1,1,1,1], "roughnessFactor": 0.8, "metallicFactor": 0.0},
        }],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    pad = (4 - len(json_bytes) % 4) % 4
    json_bytes += b" " * pad

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
        "objectsIncluded": included,
        "objectsSkippedTiny": skipped_tiny,
        "triangleCount": len(indices_arr) // 3,
        "vertexCount": len(positions_arr),
        "outputBytes": len(out),
    }


if __name__ == "__main__":
    blueprint_path, out_path = sys.argv[1], sys.argv[2]
    info = build_proxy_glb(blueprint_path, out_path)
    print(json.dumps(info, indent=2))
