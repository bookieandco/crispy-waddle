#!/usr/bin/env python3
"""
PupsonStuff 3D Asset Audit Pipeline (Task 1-4)

Usage:
    python3 scripts/audit_glb.py <path-to-glb> <asset-id> <category>

Example:
    python3 scripts/audit_glb.py public/models/hoodie.glb hoodie apparel

Produces:
    asset-audits/reports/<asset-id>.json   — raw technical audit
    asset-audits/renders/<asset-id>_*.png  — front/back/side/top/perspective
    asset-audits/scores/<asset-id>.json    — score + status + explanations
                                              + a drafted Product3DConfig

No offline glTF library was available to build this against (no
pygltflib/trimesh in this environment, no network to install them) — this
parses the binary glTF 2.0 container format directly: a 12-byte header,
a JSON chunk (scene description), and a BIN chunk (buffer data). That's a
real constraint worth knowing if this runs somewhere with those libraries
available: swapping in trimesh would be more robust for exotic glTF
features this doesn't handle (multi-mesh, skinning, sparse accessors,
compressed KHR extensions) — this covers what both real assets so far
(shirt, hoodie) actually use: single mesh, single material, embedded JPEG
textures, no animation.

WHAT THIS DOES NOT AUTOMATE, on purpose:
- "Visual score" here is a real per-asset written assessment from actually
  looking at the rendered views (this script + a human/model look), not a
  fabricated number. There's no honest way to algorithmically score "does
  this look like a believable hoodie" from vertex data alone.
- Rotation and print-zone placement in the drafted config are ALWAYS
  marked NEEDS_REVIEW. Getting those right requires seeing the asset live
  in the actual renderer (Phase 1 from the roadmap) — a script can't
  verify that a decal lands on the chest instead of a sleeve.
"""

import sys
import os
import json
import struct
from collections import defaultdict

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection


# ---------------------------------------------------------------------------
# Task 1: technical audit
# ---------------------------------------------------------------------------

def parse_glb(path):
    with open(path, "rb") as f:
        data = f.read()

    magic, version, length = struct.unpack("<4sII", data[0:12])
    if magic != b"glTF":
        raise ValueError(f"Not a valid GLB file (magic={magic!r})")
    if length != len(data):
        raise ValueError(
            f"Declared length {length} != actual file size {len(data)} — truncated or corrupt"
        )

    offset = 12
    chunks = []
    while offset < length:
        chunk_len, chunk_type = struct.unpack("<I4s", data[offset:offset + 8])
        chunk_data = data[offset + 8:offset + 8 + chunk_len]
        chunks.append((chunk_type, chunk_data))
        offset += 8 + chunk_len

    json_chunk = next((d for t, d in chunks if t == b"JSON"), None)
    bin_chunk = next((d for t, d in chunks if t == b"BIN\x00"), None)
    if json_chunk is None:
        raise ValueError("No JSON chunk found — not a valid glTF binary")

    gltf = json.loads(json_chunk)
    return gltf, bin_chunk, len(data), version


def jpeg_dimensions(jpeg_bytes):
    i = 2
    while i < len(jpeg_bytes) - 1:
        if jpeg_bytes[i] != 0xFF:
            i += 1
            continue
        marker = jpeg_bytes[i + 1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                      0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height = struct.unpack(">H", jpeg_bytes[i + 5:i + 7])[0]
            width = struct.unpack(">H", jpeg_bytes[i + 7:i + 9])[0]
            return width, height
        seg_len = struct.unpack(">H", jpeg_bytes[i + 2:i + 4])[0]
        i += 2 + seg_len
    return None


def png_dimensions(png_bytes):
    # IHDR chunk starts at byte 16 in a valid PNG (8-byte sig + 4-byte
    # length + 4-byte "IHDR"), width/height are the next 8 bytes big-endian.
    if png_bytes[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    width, height = struct.unpack(">II", png_bytes[16:24])
    return width, height


COMPONENT_TYPE_SIZES = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
COMPONENT_TYPE_DTYPE = {5121: "u1", 5123: "u2", 5125: "u4", 5126: "f4"}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_accessor(gltf, bin_chunk, accessor_index):
    acc = gltf["accessors"][accessor_index]
    bv = gltf["bufferViews"][acc["bufferView"]]
    dtype = COMPONENT_TYPE_DTYPE[acc["componentType"]]
    ncomp = TYPE_COMPONENTS[acc["type"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    itemsize = np.dtype(dtype).itemsize * ncomp
    raw = bin_chunk[start:start + itemsize * count]
    arr = np.frombuffer(raw, dtype=f"<{dtype}")
    if ncomp > 1:
        arr = arr.reshape(-1, ncomp)
    return arr


def geometry_audit(gltf, bin_chunk):
    issues = []
    meshes = gltf.get("meshes", [])
    if len(meshes) != 1:
        issues.append(f"{len(meshes)} meshes found — this pipeline only audits single-mesh assets in depth")

    result = {
        "meshCount": len(meshes),
        "materialCount": len(gltf.get("materials", [])),
        "textureCount": len(gltf.get("textures", [])),
        "hasAnimations": len(gltf.get("animations", [])) > 0,
        "issues": issues,
    }

    if not meshes:
        result["issues"].append("No meshes at all — cannot continue geometry audit")
        return result

    prim = meshes[0]["primitives"][0]
    attrs = prim["attributes"]
    result["hasUV"] = "TEXCOORD_0" in attrs
    result["hasNormals"] = "NORMAL" in attrs
    if not result["hasUV"]:
        issues.append("Missing UV coordinates (TEXCOORD_0) — cannot texture/decal this mesh")
    if not result["hasNormals"]:
        issues.append("Missing vertex normals — lighting will look flat/wrong")

    if "indices" not in prim:
        issues.append("No index buffer — cannot compute triangle count or topology")
        return result

    indices = read_accessor(gltf, bin_chunk, prim["indices"]).astype(np.int64)
    positions = read_accessor(gltf, bin_chunk, attrs["POSITION"]).astype(np.float64)

    triangles = indices.reshape(-1, 3)
    result["vertexCount"] = int(len(positions))
    result["triangleCount"] = int(len(triangles))

    bbox_min = positions.min(axis=0).tolist()
    bbox_max = positions.max(axis=0).tolist()
    result["boundingBox"] = {"min": bbox_min, "max": bbox_max,
                              "dimensions": (np.array(bbox_max) - np.array(bbox_min)).tolist()}

    # Degenerate triangles — both checks, since index-repeat alone misses
    # zero-area triangles built from 3 distinct but collinear/coincident points.
    repeated_idx = int(np.sum(
        (triangles[:, 0] == triangles[:, 1]) |
        (triangles[:, 1] == triangles[:, 2]) |
        (triangles[:, 0] == triangles[:, 2])
    ))
    v0, v1, v2 = positions[triangles[:, 0]], positions[triangles[:, 1]], positions[triangles[:, 2]]
    cross = np.cross(v1 - v0, v2 - v0)
    areas = 0.5 * np.linalg.norm(cross, axis=1)
    zero_area = int(np.sum(areas < 1e-10))
    result["degenerateTriangles"] = {"repeatedIndex": repeated_idx, "zeroArea": zero_area}
    if zero_area > 0:
        issues.append(f"{zero_area} zero-area triangles found (real degenerate geometry)")

    # Connected components: BOTH by shared index (naive, misleading for any
    # UV-seamed mesh) and by welded position (the physically meaningful one).
    n = len(positions)
    parent_idx = list(range(n))
    def find_i(x):
        while parent_idx[x] != x:
            parent_idx[x] = parent_idx[parent_idx[x]]
            x = parent_idx[x]
        return x
    def union_i(a, b):
        ra, rb = find_i(a), find_i(b)
        if ra != rb:
            parent_idx[ra] = rb
    for tri in triangles:
        union_i(tri[0], tri[1]); union_i(tri[1], tri[2])
    components_by_index = len(set(find_i(i) for i in range(n)))

    rounded = np.round(positions, decimals=5)
    _, inverse = np.unique(rounded, axis=0, return_inverse=True)
    n_welded = len(np.unique(inverse))
    parent_w = list(range(n_welded))
    def find_w(x):
        while parent_w[x] != x:
            parent_w[x] = parent_w[parent_w[x]]
            x = parent_w[x]
        return x
    def union_w(a, b):
        ra, rb = find_w(a), find_w(b)
        if ra != rb:
            parent_w[ra] = rb
    welded_tris = inverse[triangles]
    for tri in welded_tris:
        union_w(tri[0], tri[1]); union_w(tri[1], tri[2])
    components_welded = len(set(find_w(i) for i in range(n_welded)))

    result["connectedComponents"] = {
        "byVertexIndex": components_by_index,
        "byWeldedPosition": components_welded,
        "note": "byWeldedPosition is the physically meaningful count — byVertexIndex over-counts at every UV seam.",
    }
    if components_welded > 1:
        issues.append(f"{components_welded} genuinely disconnected pieces after welding — likely real fragmentation, worth investigating")

    # Watertightness / manifold check
    edge_count = defaultdict(int)
    for tri in triangles:
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            edge_count[(min(a, b), max(a, b))] += 1
    boundary_edges = sum(1 for c in edge_count.values() if c == 1)
    nonmanifold_edges = sum(1 for c in edge_count.values() if c > 2)
    result["topology"] = {
        "uniqueEdges": len(edge_count),
        "boundaryEdges": boundary_edges,
        "nonManifoldEdges": nonmanifold_edges,
        "watertight": boundary_edges == 0 and nonmanifold_edges == 0,
    }
    if nonmanifold_edges > 0:
        issues.append(f"{nonmanifold_edges} non-manifold edges — can cause rendering artifacts, worth checking visually")
    # NOT watertight alone is not appended as an issue — it's expected/fine
    # for a visual web asset per the roadmap's own stated principle; only
    # flagged as informational in boundaryEdges above.

    result["positions"] = positions
    result["triangles"] = triangles
    return result


def material_audit(gltf, bin_chunk):
    result = {"materials": [], "issues": []}
    materials = gltf.get("materials", [])
    images = gltf.get("images", [])
    textures = gltf.get("textures", [])
    buffer_views = gltf.get("bufferViews", [])

    image_dims = []
    for img in images:
        if "bufferView" not in img:
            image_dims.append(None)
            continue
        bv = buffer_views[img["bufferView"]]
        start = bv.get("byteOffset", 0)
        raw = bin_chunk[start:start + bv["byteLength"]]
        mime = img.get("mimeType", "")
        if "jpeg" in mime or "jpg" in mime:
            image_dims.append(jpeg_dimensions(raw))
        elif "png" in mime:
            image_dims.append(png_dimensions(raw))
        else:
            image_dims.append(None)
            result["issues"].append(f"Unrecognized image MIME type: {mime}")

    for i, mat in enumerate(materials):
        pbr = mat.get("pbrMetallicRoughness", {})
        base_tex_idx = pbr.get("baseColorTexture", {}).get("index")
        normal_tex_idx = mat.get("normalTexture", {}).get("index")

        def tex_dims(tex_idx):
            if tex_idx is None:
                return None
            src = textures[tex_idx].get("source")
            if src is None or src >= len(image_dims):
                return None
            return image_dims[src]

        m = {
            "name": mat.get("name", f"<unnamed material {i}>"),
            "hasBaseColorTexture": base_tex_idx is not None,
            "baseColorTextureDims": tex_dims(base_tex_idx),
            "baseColorFactor": pbr.get("baseColorFactor"),
            "hasNormalTexture": normal_tex_idx is not None,
            "normalTextureDims": tex_dims(normal_tex_idx),
            "metallicFactor": pbr.get("metallicFactor", 1.0),
            "roughnessFactor": pbr.get("roughnessFactor", 1.0),
            "doubleSided": mat.get("doubleSided", False),
            "alphaMode": mat.get("alphaMode", "OPAQUE"),
        }
        # A flat baseColorFactor with no texture is a legitimate design (a
        # material meant to be dynamically tinted, e.g. via material-color
        # in Product3DEngine) — only flag as an issue if there's NEITHER a
        # texture NOR an explicit color, which would render as an undefined
        # default.
        if not m["hasBaseColorTexture"] and m["baseColorFactor"] is None:
            result["issues"].append(f"Material '{m['name']}' has no base color texture AND no baseColorFactor — will render with an undefined default color")
        if m["baseColorTextureDims"] and max(m["baseColorTextureDims"]) < 512:
            result["issues"].append(f"Material '{m['name']}' base color texture is low-res ({m['baseColorTextureDims']}) for a hero product shot")
        result["materials"].append(m)

    if not materials:
        result["issues"].append("No materials at all")

    return result


# ---------------------------------------------------------------------------
# Task 2: visual QA renders
# ---------------------------------------------------------------------------

def render_views(positions, triangles, out_dir, asset_id):
    verts = positions[triangles]
    v0, v1, v2 = verts[:, 0], verts[:, 1], verts[:, 2]
    face_normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(face_normals, axis=1, keepdims=True)
    norms[norms == 0] = 1
    face_normals = face_normals / norms
    light_dir = np.array([0.4, 0.6, 0.7])
    light_dir = light_dir / np.linalg.norm(light_dir)
    shade = np.clip(face_normals @ light_dir, 0.15, 1.0)

    views = {
        "front": (10, 90), "back": (10, -90), "side": (10, 0),
        "top": (85, -90), "perspective": (25, 45),
    }
    paths = {}
    for name, (elev, azim) in views.items():
        fig = plt.figure(figsize=(4, 4))
        ax = fig.add_subplot(111, projection="3d")
        colors = plt.cm.Oranges(shade * 0.7 + 0.2)
        pc = Poly3DCollection(verts, facecolors=colors, edgecolor=None, linewidths=0)
        ax.add_collection3d(pc)
        mins, maxs = positions.min(axis=0), positions.max(axis=0)
        center = (mins + maxs) / 2
        span = (maxs - mins).max() / 2 * 1.1
        ax.set_xlim(center[0] - span, center[0] + span)
        ax.set_ylim(center[1] - span, center[1] + span)
        ax.set_zlim(center[2] - span, center[2] + span)
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        ax.set_title(f"{asset_id} — {name}", fontsize=10)
        plt.tight_layout()
        path = os.path.join(out_dir, f"{asset_id}_{name}.png")
        plt.savefig(path, dpi=130, facecolor="#1a1a1a")
        plt.close()
        paths[name] = path
    return paths


# ---------------------------------------------------------------------------
# Task 3: scoring
# ---------------------------------------------------------------------------

def compute_technical_score(geo, mat):
    score = 100
    deductions = []
    if not geo.get("hasUV"):
        score -= 40; deductions.append(("Missing UVs", -40))
    if not geo.get("hasNormals"):
        score -= 15; deductions.append(("Missing normals", -15))
    dz = geo.get("degenerateTriangles", {}).get("zeroArea", 0)
    tri_count = max(geo.get("triangleCount", 1), 1)
    if dz > 0:
        pct = dz / tri_count
        deduction = min(10, pct * 1000)
        score -= deduction; deductions.append((f"{dz} zero-area triangles", -round(deduction, 1)))
    welded_components = geo.get("connectedComponents", {}).get("byWeldedPosition", 1)
    if welded_components > 1:
        deduction = min(30, (welded_components - 1) * 10)
        score -= deduction; deductions.append((f"{welded_components} real disconnected pieces", -deduction))
    if geo.get("topology", {}).get("nonManifoldEdges", 0) > 0:
        score -= 10; deductions.append(("Non-manifold edges present", -10))
    for issue in mat.get("issues", []):
        score -= 5; deductions.append((issue, -5))
    return max(0, round(score, 1)), deductions


def determine_status(technical_score, geo, mat):
    if technical_score < 50:
        return "REJECTED"
    if (not geo.get("hasUV")) or (not geo.get("hasNormals")):
        return "REJECTED"
    if geo.get("connectedComponents", {}).get("byWeldedPosition", 1) > 1:
        return "NEEDS_FIXES"
    if technical_score < 85:
        return "NEEDS_FIXES"
    return "APPROVED"


# ---------------------------------------------------------------------------
# Task 4: draft a Product3DEngine config from what the audit learned
# ---------------------------------------------------------------------------

def find_node_name_for_mesh(gltf, mesh_index):
    """
    @react-three/drei's useGLTF exposes `nodes` keyed by NODE name, not raw
    mesh.name — Product3DEngine.tsx does `nodes[config.meshName]`, so
    meshName here MUST be the node's name, not gltf.meshes[i].name. These
    can differ: the shirt asset has mesh.name == "Mesh" but its node is
    named "T_Shirt_male" — using the raw mesh name would produce a config
    that fails to load in the actual engine.
    """
    for node in gltf.get("nodes", []):
        if node.get("mesh") == mesh_index:
            return node.get("name")
    return None


def draft_config(asset_id, display_name, glb_public_path, gltf, geo):
    node_name = find_node_name_for_mesh(gltf, 0)
    mesh_name = node_name or gltf["meshes"][0].get("name") or "NEEDS_REVIEW_no_mesh_name"
    material_name = gltf["materials"][0].get("name", "NEEDS_REVIEW_no_material_name") if gltf.get("materials") else "NEEDS_REVIEW"

    dims = geo.get("boundingBox", {}).get("dimensions", [1, 1, 1])
    largest_dim = max(dims) if dims else 1
    # rough heuristic: frame the camera so the largest dimension fills most
    # of the view — a real starting point, not a substitute for looking at it
    cam_distance = round(largest_dim * 2.6, 2)

    return {
        "id": asset_id,
        "displayName": display_name,
        "glbPath": glb_public_path,
        "meshName": mesh_name,
        "materialName": material_name,
        "supportsColorChange": "NEEDS_REVIEW — check whether the baked texture reads correctly under a color multiply",
        "modelRotation": "NEEDS_REVIEW — verify orientation live before trusting any value here",
        "camera": {
            "position": [0, 0, cam_distance],
            "fov": 30,
            "minDistance": round(cam_distance * 0.65, 2),
            "maxDistance": round(cam_distance * 1.4, 2),
        },
        "printAreas": [
            {
                "name": "front",
                "position": "NEEDS_REVIEW — placeholder, verify against actual UVs/geometry",
                "rotation": [0, 0, 0],
                "scale": "NEEDS_REVIEW",
            }
        ],
    }


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    glb_path, asset_id, category = sys.argv[1], sys.argv[2], sys.argv[3]
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    reports_dir = os.path.join(project_root, "asset-audits", "reports")
    renders_dir = os.path.join(project_root, "asset-audits", "renders")
    scores_dir = os.path.join(project_root, "asset-audits", "scores")
    for d in (reports_dir, renders_dir, scores_dir):
        os.makedirs(d, exist_ok=True)

    print(f"Auditing {glb_path} as '{asset_id}' ({category})...")
    gltf, bin_chunk, file_size, gltf_version = parse_glb(glb_path)

    geo = geometry_audit(gltf, bin_chunk)
    mat = material_audit(gltf, bin_chunk)

    positions = geo.pop("positions", None)
    triangles = geo.pop("triangles", None)

    render_paths = {}
    if positions is not None and triangles is not None:
        render_paths = render_views(positions, triangles, renders_dir, asset_id)

    technical_score, deductions = compute_technical_score(geo, mat)
    status = determine_status(technical_score, geo, mat)

    report = {
        "assetId": asset_id,
        "category": category,
        "sourceFile": os.path.basename(glb_path),
        "fileSizeBytes": file_size,
        "gltfVersion": gltf_version,
        "geometry": geo,
        "materials": mat,
        "renders": {k: os.path.relpath(v, project_root) for k, v in render_paths.items()},
    }
    with open(os.path.join(reports_dir, f"{asset_id}.json"), "w") as f:
        json.dump(report, f, indent=2)

    config_draft = draft_config(
        asset_id, asset_id.capitalize(), f"/models/{os.path.basename(glb_path)}", gltf, geo
    )

    score_report = {
        "assetId": asset_id,
        "technicalScore": technical_score,
        "technicalDeductions": deductions,
        "visualScore": "NOT AUTOMATED — requires a real look at asset-audits/renders/*, not a fabricated number",
        "status": status,
        "explanations": geo.get("issues", []) + mat.get("issues", []),
        "draftedConfig": config_draft,
    }
    with open(os.path.join(scores_dir, f"{asset_id}.json"), "w") as f:
        json.dump(score_report, f, indent=2)

    print(f"  technical score: {technical_score}/100 -> {status}")
    print(f"  report:  asset-audits/reports/{asset_id}.json")
    print(f"  renders: asset-audits/renders/{asset_id}_*.png")
    print(f"  score:   asset-audits/scores/{asset_id}.json")


if __name__ == "__main__":
    main()
