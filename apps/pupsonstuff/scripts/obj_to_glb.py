#!/usr/bin/env python3
"""
Minimal OBJ(+MTL) -> GLB converter.

Built because no offline conversion tool was available (no trimesh, no
Blender CLI, no assimp, no network to install any of them). Handles what
the 11oz-Mug.obj actually uses: v/vn/vt attributes, quad or triangle faces
(quads are triangulated as a simple fan: for a quad a,b,c,d -> triangles
(a,b,c) and (a,c,d) — fine for the roughly-planar quads a subdivision-style
mesh like this produces; would NOT be safe for a very non-planar quad),
single material, no texture (Kd/Ks/Ns/illum only). Does not handle:
multiple materials per file, texture maps, negative/relative OBJ indices
beyond what's tested here, or non-quad/tri polygons.
"""

import sys
import re
import struct
import json
import numpy as np


def parse_obj(path):
    positions, normals, uvs = [], [], []
    faces = []  # list of list of (vi, ti, ni) 0-indexed, None if absent

    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("v "):
                positions.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vn "):
                normals.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                parts = line.split()[1:3]
                uvs.append([float(parts[0]), float(parts[1])])
            elif line.startswith("f "):
                corners = []
                for token in line.split()[1:]:
                    parts = token.split("/")
                    vi = int(parts[0]) - 1 if parts[0] else None
                    ti = int(parts[1]) - 1 if len(parts) > 1 and parts[1] else None
                    ni = int(parts[2]) - 1 if len(parts) > 2 and parts[2] else None
                    corners.append((vi, ti, ni))
                faces.append(corners)

    return np.array(positions, dtype=np.float32), \
           np.array(normals, dtype=np.float32) if normals else None, \
           np.array(uvs, dtype=np.float32) if uvs else None, \
           faces


def parse_mtl(path):
    if not path:
        return {}
    mat = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("Kd "):
                mat["baseColorFactor"] = [float(x) for x in line.split()[1:4]] + [1.0]
            elif line.startswith("Ks "):
                mat["specular"] = [float(x) for x in line.split()[1:4]]
            elif line.startswith("Ns "):
                mat["shininess"] = float(line.split()[1])
    return mat


def build_glb(positions, normals, uvs, faces, material, out_path, mesh_name, material_name):
    # Build unique (vi,ti,ni) -> new-vertex-index map, triangulating quads.
    vert_map = {}
    out_positions, out_normals, out_uvs = [], [], []
    indices = []

    def get_vertex(corner):
        if corner not in vert_map:
            vi, ti, ni = corner
            vert_map[corner] = len(out_positions)
            out_positions.append(positions[vi])
            out_normals.append(normals[ni] if normals is not None and ni is not None else [0, 0, 1])
            out_uvs.append(uvs[ti] if uvs is not None and ti is not None else [0, 0])
        return vert_map[corner]

    for face in faces:
        if len(face) == 3:
            tris = [face]
        elif len(face) == 4:
            # Splitting every quad along the same fixed diagonal (a-c)
            # produces sliver/zero-area triangles for quads where that
            # diagonal happens to be much longer than the other one —
            # found this for real auditing the first conversion attempt
            # (255 of 260 zero-area triangles were adjacent pairs from the
            # same source quad). Standard fix: measure both diagonals,
            # split along the shorter one.
            pa, pb, pc, pd = (positions[c[0]] for c in face)
            diag_ac = np.linalg.norm(np.array(pa) - np.array(pc))
            diag_bd = np.linalg.norm(np.array(pb) - np.array(pd))
            if diag_ac <= diag_bd:
                tris = [[face[0], face[1], face[2]], [face[0], face[2], face[3]]]
            else:
                tris = [[face[0], face[1], face[3]], [face[1], face[2], face[3]]]
        else:
            # fan-triangulate anything larger, best-effort
            tris = [[face[0], face[i], face[i + 1]] for i in range(1, len(face) - 1)]
        for tri in tris:
            for corner in tri:
                indices.append(get_vertex(corner))

    positions_arr = np.array(out_positions, dtype=np.float32)
    normals_arr = np.array(out_normals, dtype=np.float32)
    uvs_arr = np.array(out_uvs, dtype=np.float32)
    indices_arr = np.array(indices, dtype=np.uint32)

    pos_bytes = positions_arr.tobytes()
    norm_bytes = normals_arr.tobytes()
    uv_bytes = uvs_arr.tobytes()
    idx_bytes = indices_arr.tobytes()

    def pad4(b):
        return b + b"\x00" * ((4 - len(b) % 4) % 4)

    pos_bytes, norm_bytes, uv_bytes, idx_bytes = map(pad4, (pos_bytes, norm_bytes, uv_bytes, idx_bytes))

    bin_chunks = [idx_bytes, pos_bytes, norm_bytes, uv_bytes]
    offsets = []
    running = 0
    for c in bin_chunks:
        offsets.append(running)
        running += len(c)
    bin_data = b"".join(bin_chunks)

    buffer_views = [
        {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(idx_bytes), "target": 34963},
        {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(pos_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(norm_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(uv_bytes), "target": 34962},
    ]

    pmin, pmax = positions_arr.min(axis=0).tolist(), positions_arr.max(axis=0).tolist()
    accessors = [
        {"bufferView": 0, "componentType": 5125, "count": len(indices_arr), "type": "SCALAR"},
        {"bufferView": 1, "componentType": 5126, "count": len(positions_arr), "type": "VEC3", "min": pmin, "max": pmax},
        {"bufferView": 2, "componentType": 5126, "count": len(normals_arr), "type": "VEC3"},
        {"bufferView": 3, "componentType": 5126, "count": len(uvs_arr), "type": "VEC2"},
    ]

    base_color = material.get("baseColorFactor", [0.8, 0.8, 0.8, 1.0])
    shininess = material.get("shininess", 30.0)
    # crude Blinn-Phong-shininess -> PBR-roughness heuristic, not a real
    # conversion (there isn't a exact one) -- reasonable enough for a
    # visual preview.
    roughness = max(0.05, min(1.0, 1.0 - (shininess / 1000.0)))

    gltf = {
        "asset": {"version": "2.0", "generator": "PupsonStuff manual OBJ->GLB converter"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": mesh_name, "mesh": 0}],
        "meshes": [{
            "name": mesh_name,
            "primitives": [{
                "attributes": {"POSITION": 1, "NORMAL": 2, "TEXCOORD_0": 3},
                "indices": 0,
                "material": 0,
                "mode": 4,
            }],
        }],
        "materials": [{
            "name": material_name,
            "pbrMetallicRoughness": {
                "baseColorFactor": base_color,
                "metallicFactor": 0.0,
                "roughnessFactor": roughness,
            },
            "doubleSided": False,
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
        "vertexCount": len(positions_arr),
        "triangleCount": len(indices_arr) // 3,
        "outPath": out_path,
    }


if __name__ == "__main__":
    obj_path, mtl_path, out_path, mesh_name, material_name = sys.argv[1:6]
    positions, normals, uvs, faces = parse_obj(obj_path)
    material = parse_mtl(mtl_path)
    info = build_glb(positions, normals, uvs, faces, material, out_path, mesh_name, material_name)
    print(json.dumps(info, default=str, indent=2))
