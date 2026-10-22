#!/usr/bin/env python3
"""PUPSON-3D.FACTORY.GENERATE.04-.05: local Blender visual QA only.

Produces 6 reproducible front/side/back screenshots of a candidate against an
approved baseline. No model or materials are modified or installed. Review
files MUST be written outside storefront/public and assets/approved under a
quarantine directory. Operator views them to approve/reject separately.

blender -b --python scripts/render_candidate_comparison.py -- \
  --candidate /private/quarantine/tote-candidate.glb \
  --approved /checkout/apps/pupsonstuff/public/models/tote.glb \
  --out /private/quarantine/tote-screenshots --render
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

VIEW_NAMES = ("front", "side", "back")
SCREEN_SIZE = 600


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as src:
        for batch in iter(lambda: src.read(1024 * 1024), b""):
            h.update(batch)
    return h.hexdigest()


def check_inputs(candidate, approved, output):
    candidate, approved, output = [Path(p).expanduser().resolve() for p in (candidate, approved, output)]
    if not candidate.is_file() or not approved.is_file():
        raise ValueError("CANDIDATE_AND_APPROVED_GLB_REQUIRED")
    if candidate.suffix.lower() != ".glb" or approved.suffix.lower() != ".glb":
        raise ValueError("ONLY_GLB_COMPARISON_SUPPORTED")
    if candidate == approved:
        raise ValueError("CANDIDATE_CANNOT_EQUAL_APPROVED_MODEL")
    if "quarantine" not in candidate.parts or "quarantine" not in output.parts:
        raise ValueError("REVIEW_INPUT_AND_OUTPUT_MUST_BE_QUARANTINED")
    if "public" in output.parts or "approved" in output.parts:
        raise ValueError("STOREFRONT_OUTPUT_FORBIDDEN")
    if output.exists() and any(output.iterdir()):
        raise ValueError("NO_OVERWRITE_OF_PREVIOUS_QA_EVIDENCE")
    return candidate, approved, output


def setup_scene(bpy, path):
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError("CURRENT_VIEWER_ONE_MESH_REQUIRED")
    obj = meshes[0]
    if not obj.data.vertices:
        raise ValueError("EMPTY_MESH")
    world = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    lower = Vector(tuple(min(v[i] for v in world) for i in range(3)))
    upper = Vector(tuple(max(v[i] for v in world) for i in range(3)))
    center = (lower + upper) / 2
    dims = tuple(upper[i] - lower[i] for i in range(3))
    if any(not math.isfinite(v) or v <= 0 for v in dims):
        raise ValueError("INVALID_MESH_BOUNDS")
    return obj, center, dims


def add_light(bpy, name, xyz, watts, shape="DISK", size=3):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = watts
    data.shape = shape
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = xyz
    return obj


def configure_studio(bpy, center, dims):
    from mathutils import Vector
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 20
    scene.render.resolution_x = SCREEN_SIZE
    scene.render.resolution_y = SCREEN_SIZE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("Pupson studio neutral")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.97, 0.96, 0.94, 1)
    bg.inputs["Strength"].default_value = 0.55
    bbox = max(dims)
    s = max(0.3, bbox)
    add_light(bpy, "Key large softbox", center + Vector((s, -2*s, 2.1*s)), 225, size=3*s)
    add_light(bpy, "Fill softbox", center + Vector((-1.8*s, -0.5*s, 1.1*s)), 125, size=2*s)
    add_light(bpy, "Rim softbox", center + Vector((s, 2*s, 1.9*s)), 150, size=2*s)
    camera_data = bpy.data.cameras.new("Turntable camera")
    camera = bpy.data.objects.new("Turntable camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = bbox * 1.6
    # z is up in Blender; glTF +Y maps to Blender +Z when imported.
    return camera, center, bbox


def view_position(label, center, r):
    from mathutils import Vector
    offset = {
        "front": Vector((0, -3*r, 0.2*r)),
        "side": Vector((3*r, 0, 0.2*r)),
        "back": Vector((0, 3*r, 0.2*r)),
    }[label]
    return center + offset


def render_set(bpy, source, outdir, prefix):
    _, center, dims = setup_scene(bpy, source)
    cam, center, r = configure_studio(bpy, center, dims)
    from mathutils import Vector
    names = []
    for label in VIEW_NAMES:
        cam.location = view_position(label, center, r)
        look = center - cam.location
        cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
        filename = outdir / f"{prefix}-{label}.png"
        bpy.context.scene.render.filepath = str(filename)
        bpy.ops.render.render(write_still=True)
        names.append(filename.name)
    return {"sourceSha256": sha256(source), "viewImages": names,
            "blenderBounds": list(dims), "studioLighting": "pupson-softbox-cpu-v1"}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--approved", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--render", action="store_true")
    av = argv if argv is not None else (sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    args = parser.parse_args(av)
    candidate, approved, out = check_inputs(args.candidate, args.approved, args.out)
    evidence = {"status": "REVIEW_ONLY", "storefrontApproved": False,
                "candidateSha256": sha256(candidate), "approvedSha256": sha256(approved),
                "viewsRequired": list(VIEW_NAMES),
                "passNotAsserted": ["matching real supplier SKU/dimensions",
                                    "print zone and front-only decal behavior",
                                    "fabrics, handles, seams and physical product likeness",
                                    "physical iPhone Safari and actual Printify sample"]}
    if not args.render:
        print(json.dumps({"mode": "dry-run", **evidence}, indent=2))
        return 0
    import bpy
    out.mkdir(parents=True, exist_ok=True)
    evidence["approved"] = render_set(bpy, approved, out, "approved")
    evidence["candidate"] = render_set(bpy, candidate, out, "candidate")
    (out / "comparison.review.json").write_text(
        json.dumps(evidence, indent=2) + "\n", encoding="utf8"
    )
    print(json.dumps({"mode": "screenshots-created-review-only", **evidence}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
