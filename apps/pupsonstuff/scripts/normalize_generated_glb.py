#!/usr/bin/env python3
"""Source-only, locally executable Blender candidate normalizer.

Usage (on an operator-owned machine with Blender already installed):
  blender -b -t 2 --python scripts/normalize_generated_glb.py -- \
    --input /local/candidate.glb \
    --output /private/quarantine/hoodie-01.glb \
    --vendor-mm 500,700,120 \
    --asset-id hoodie-candidate-01 \
    --material textile \
    --vendor-evidence "SKU sample measurements and operator proof" \
    --front-verified --write-quarantine

It cannot run any 3D generator, train/download a checkpoint, spend money,
read customer media, promote a storefront asset, or modify a print master.
Run without --write-quarantine to inspect dimensions without writing files.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

MAX_TRIANGLES = 120_000
MAX_BYTES = 10 * 1024 * 1024
PROFILE = {
    "textile": (0.0, 0.86),
    "ceramic": (0.0, 0.24),
    "canvas": (0.0, 0.92),
    "metal": (0.72, 0.32),
}
STANDARD = "pupson-physical-product-v1"


def parse_measurements(text):
    try:
        dimensions = tuple(float(x.strip()) for x in text.split(","))
    except ValueError as exc:
        raise ValueError("Expected width,height,depth measurements in millimeters") from exc
    if len(dimensions) != 3 or any(
        not math.isfinite(x) or x <= 0 or x > 3000 for x in dimensions
    ):
        raise ValueError("All three measured dimensions must be >0 and <=3000 mm")
    return dimensions


def uniform_scale_plan(raw_w_h_d, target_w_h_d):
    """Single height-derived factor, never distort product proportions."""
    if len(raw_w_h_d) != 3 or any(not math.isfinite(n) or n <= 0 for n in raw_w_h_d):
        raise ValueError("Source geometry dimensions must be positive")
    if len(target_w_h_d) != 3 or any(not math.isfinite(n) or n <= 0 for n in target_w_h_d):
        raise ValueError("Vendor dimensions must be positive")
    w, h, d = target_w_h_d
    raw_w, raw_h, raw_d = raw_w_h_d
    scale = h / (1000 * raw_h)
    actual = (raw_w * scale, raw_h * scale, raw_d * scale)
    errors = (
        abs(actual[0] - w / 1000) / (w / 1000),
        0,
        abs(actual[2] - d / 1000) / (d / 1000),
    )
    if max(errors) > 0.07:
        raise ValueError(
            "NONUNIFORM_PROPORTIONS_REFUSE_DISTORTION: candidate mismatches "
            f"measured SKU by {round(max(errors) * 100, 2)}%"
        )
    return scale, actual


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def args_from_blender():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--vendor-mm", required=True, help="actual SKU width,height,depth in mm")
    parser.add_argument("--vendor-evidence", required=True)
    parser.add_argument("--material", choices=sorted(PROFILE), required=True)
    parser.add_argument("--front-verified", action="store_true")
    parser.add_argument("--write-quarantine", action="store_true")
    parser.add_argument("--generator-receipt", default="", help="saved, pre-approved generator run evidence")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def main():
    args = args_from_blender()
    import re
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", args.asset_id):
        raise ValueError("INVALID_ASSET_ID")
    if not args.front_verified:
        raise ValueError("FRONT_ORIENTATION_NOT_VERIFIED")
    if len(args.vendor_evidence.strip()) < 8:
        raise ValueError("VENDOR_SKU_DIMENSIONS_NOT_EVIDENCED")
    vendor_mm = parse_measurements(args.vendor_mm)
    src = Path(args.input).expanduser().resolve(strict=True)
    output = Path(args.output).expanduser().resolve()
    if src.suffix.lower() != ".glb" or output.suffix.lower() != ".glb":
        raise ValueError("INPUT_AND_OUTPUT_MUST_BE_GLB")
    if "quarantine" not in output.parts:
        raise ValueError("OUTPUT_MUST_BE_IN_QUARANTINE_DIRECTORY")
    if output.exists() or src == output:
        raise ValueError("REFUSE_TO_OVERWRITE_OR_REPLACE_APPROVED_ASSET")
    if args.write_quarantine and len(args.generator_receipt.strip()) < 8:
        raise ValueError("SEPARATE_GENERATOR_RUN_APPROVAL_RECEIPT_REQUIRED")

    try:
        import bpy
        from mathutils import Vector
    except ImportError as exc:
        raise RuntimeError("Blender's Python runtime is required (bpy unavailable)") from exc

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(src))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(objects) != 1:
        raise ValueError("ONE_MESH_REQUIRED_UNTIL_APPROVED_TEXTURE_ATLAS_BAKING_EXISTS")
    obj = objects[0]
    if len(obj.data.materials) != 1 or obj.data.materials[0] is None:
        raise ValueError("ONE_VALID_MATERIAL_REQUIRED; NEVER_SILENTLY_DROP_PBR_TEXTURES")
    if not obj.data.uv_layers:
        raise ValueError("UV_REQUIRED")
    triangles = sum(max(0, len(face.vertices) - 2) for face in obj.data.polygons)
    if triangles == 0 or triangles > MAX_TRIANGLES:
        raise ValueError("TRIANGLE_BUDGET_EXCEEDED")

    # Blender internally uses Z up and -Y forward; the GLB exporter converts
    # to the canonical GLB convention (Y up and +Z toward the front camera).
    # The front axis is verified by an operator, not inferred from a bounding box.
    world = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xyz_min = [min(v[i] for v in world) for i in range(3)]
    xyz_max = [max(v[i] for v in world) for i in range(3)]
    raw = (
        xyz_max[0] - xyz_min[0],  # GLB width
        xyz_max[2] - xyz_min[2],  # GLB height
        xyz_max[1] - xyz_min[1],  # GLB depth
    )
    scale, normalized = uniform_scale_plan(raw, vendor_mm)
    print(json.dumps({
        "stage": "INSPECTED_NO_STORE_APPROVAL", "assetId": args.asset_id,
        "rawBoundsBlender": raw, "uniformScale": scale,
        "normalizedMeters": normalized, "triangles": triangles,
    }, sort_keys=True))
    if not args.write_quarantine:
        print("DRY RUN — no GLB or vendor-facing changes made")
        return

    # Transform the *mesh* using Blender matrices, not position-only loops.
    # This preserves normals and tangent-space orientation when the source
    # GLB is rotated, scaled or translated. Physical proportions remain fixed.
    from mathutils import Matrix, Vector
    center = Vector(tuple((xyz_min[i] + xyz_max[i]) / 2 for i in range(3)))
    correction = (
        Matrix.Scale(scale, 4) @
        Matrix.Translation(-center) @
        obj.matrix_world.copy()
    )
    obj.data.transform(correction, shape_keys=True)
    obj.matrix_world.identity()
    obj.data.update()
    obj.name = args.asset_id
    mat = obj.data.materials[0]
    mat.name = f"{args.asset_id}_{args.material}"
    metalness, roughness = PROFILE[args.material]
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                for socket_name, target in (("Metallic", metalness), ("Roughness", roughness)):
                    socket = node.inputs.get(socket_name)
                    if socket and not socket.is_linked:
                        socket.default_value = target
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", export_yup=True, use_selection=True
    )
    if output.stat().st_size > MAX_BYTES:
        output.unlink()
        raise ValueError("MOBILE_GLB_FILESIZE_BUDGET_EXCEEDED")
    report = {
        "assetId": args.asset_id,
        "sourceSha256": sha256_file(src),
        "quarantinedGlbSha256": sha256_file(output),
        "vendorEvidence": args.vendor_evidence,
        "generatorRunReceipt": args.generator_receipt,
        "studioStandard": STANDARD,
        "front": "+Z", "up": "+Y", "units": "meters",
        "pivot": "bounding-box-center",
        "sizeMeters": normalized,
        "triangles": triangles, "materials": 1,
        "needsHumanReview": True, "storefrontApproved": False,
        "printAreaCertified": False, "vendorSampleCertified": False,
        "furtherChecks": [
            "candidate-intake SHA/license/GLB preflight",
            "audit_glb.py technical geometry audit",
            "mobile front/side/back screenshot matrix",
            "actual SKU comparison and Printify print-zone proof",
        ],
    }
    report_path = output.with_suffix(".review.json")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"QUARANTINED ONLY: {output} | review receipt {report_path}")


if __name__ == "__main__":
    main()
