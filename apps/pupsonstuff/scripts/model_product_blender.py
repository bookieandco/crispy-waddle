#!/usr/bin/env python3
"""
Procedurally models a PupsonStuff product (bottle or tote) using
Blender's Python API (bpy) and exports it as a raw .glb — a THIRD source
for filling the "no real mesh yet" gap in config/product3dModels.ts,
alongside the licensed-mesh (shirt), Stable-Fast-3D (hoodie), and manual-
OBJ-conversion (mug) sources already used.

Why this instead of scripts/generate_3d_from_image.py (image-to-3D via
Hugging Face): that path is genuinely blocked from this environment right
now (huggingface.co AND *.hf.space both return a real 403 policy denial —
see docs/boutique-design/product-3d-generation.md). This script needs
NOTHING from the network — Blender, once installed, runs entirely
locally. Real tradeoff, stated plainly: this produces a plausible generic
proxy shape from real-world dimensions, not a reconstruction of any
specific real product the way an image-to-3D model would be. Good enough
to unblock a first Product3DEngine entry and go through the audit
pipeline; swap for a photo-derived or manufacturer-supplied mesh later if
one becomes available.

First real pass (kept as history, not silently overwritten): three
stacked/joined primitives (body+neck+cap for the bottle, body+2 handle
tori for the tote) via bpy.ops.object.join(). Ran it, audited it for
real, and the audit caught something genuinely true: join() merges
objects into one mesh DATA block but does not weld or connect geometry
where parts merely touch — 3 real disconnected pieces each, confirmed by
scripts/audit_glb.py, not assumed. remove_doubles() alone didn't fix the
bottle (the neck/body cap faces are different radii — no coincident
vertices to weld, so nothing to merge), so:
- Bottle is now a proper lathe/revolve (bmesh spin around Z from a single
  vertical profile) — genuinely one continuous surface, no seams to weld
  in the first place, and a smoother/more realistic silhouette than three
  stacked cylinders besides.
- Tote's handles are now Boolean-unioned into the body (real overlapping
  solid geometry, merged by Blender's boolean solver) rather than merely
  touching — guarantees real shared topology regardless of exact vertex
  alignment.

Usage (Blender must be installed — `apt-get install blender`, confirmed
working in this environment, Blender 4.0.2; also needs numpy in
Blender's own Python for the glTF exporter addon — this build links
system python3.12, so `python3.12 -m pip install --break-system-packages
numpy`, also confirmed working):
    blender --background --python scripts/model_product_blender.py -- bottle
    blender --background --python scripts/model_product_blender.py -- tote

Output: assets/needs-review/<product>.glb — same next step as every other
asset source: `python3 scripts/audit_glb.py assets/needs-review/<product>.glb <product> <category>`.
"""

import math
import sys
import os

import bpy
import bmesh
from mathutils import Vector, Matrix


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)


def new_material(name, color_rgba, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color_rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def finish_object(obj, name, material, weld=True):
    bpy.context.view_layer.objects.active = obj
    obj.name = name

    if weld:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=0.0015)
        bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.shade_smooth()

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=66, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")

    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


def model_bottle():
    """20oz insulated bottle, built as a single lathe/revolve surface from
    a real-world-proportioned vertical profile (radius, z) — ~7.3cm body
    diameter, ~20cm body height, tapered shoulder, narrower neck, small
    cap. One continuous mesh, no seams. Matches data/hotspots.ts's
    "Insulated Bottle" (20oz)."""
    body_radius = 0.0365
    body_height = 0.20
    shoulder_height = 0.02
    neck_radius = 0.014
    neck_height = 0.03
    cap_radius = 0.016
    cap_height = 0.022
    total_height = body_height + shoulder_height + neck_height + cap_height

    # Real bug, found live in Playwright (not caught by the audit, which
    # never checks vertical centering): Product3DEngine's ProductMesh only
    # ever reads `nodes[meshName]?.geometry` — the RAW local mesh data —
    # never the node's own translation/rotation/scale. tote_body happens
    # to export with an object-level translation Blender's exporter never
    # baked into vertex data (only `transform_apply(scale=True)` ran on
    # it, not location), so its *raw* vertices are naturally centered on
    # (0,0,0) and render correctly purely by coincidence. This profile
    # was built starting at z=0 (see below) with no equivalent, so its raw
    # vertices spanned z=0..total_height — OrbitControls' default target
    # (0,0,0) is the bottle's BASE, not its middle, so the camera framed
    # roughly the bottom half and cropped the cap clean off. Shifting the
    # profile down by total_height/2 up front means the vertex data that
    # actually reaches the renderer is centered, same as tote's.
    half_height = total_height / 2.0

    # (radius, z) from base to top. Starting and ending at radius 0 lets
    # spin() naturally close the bottom/top into poles, like a lathe.
    profile = [
        (0.0, 0.0 - half_height),
        (body_radius * 0.9, 0.0 - half_height),
        (body_radius, 0.01 - half_height),
        (body_radius, body_height - half_height),
        (body_radius * 0.55, body_height + shoulder_height - half_height),
        (neck_radius, body_height + shoulder_height + 0.008 - half_height),
        (neck_radius, body_height + shoulder_height + neck_height - half_height),
        (cap_radius, body_height + shoulder_height + neck_height + 0.006 - half_height),
        (cap_radius, body_height + shoulder_height + neck_height + cap_height - half_height),
        (0.0, body_height + shoulder_height + neck_height + cap_height - half_height),
    ]

    mesh = bpy.data.meshes.new("bottle_mesh")
    obj = bpy.data.objects.new("bottle_body", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    profile_verts = [bm.verts.new((r, 0.0, z)) for r, z in profile]
    for i in range(len(profile_verts) - 1):
        bm.edges.new((profile_verts[i], profile_verts[i + 1]))

    segments = 48
    geom_in = list(bm.verts) + list(bm.edges)
    bmesh.ops.spin(
        bm,
        geom=geom_in,
        angle=math.radians(360),
        steps=segments,
        axis=(0, 0, 1),
        cent=(0, 0, 0),
    )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    mat = new_material("bottle_material", (0.75, 0.76, 0.78, 1.0), roughness=0.35, metallic=0.6)
    return finish_object(obj, "bottle_body", mat, weld=False)


def model_tote():
    """Natural canvas tote — real-world proportions: ~38cm wide, ~42cm
    tall, ~10cm gusset depth, two arched handles Boolean-unioned into the
    body (real merged solid geometry, not just touching). Matches
    data/hotspots.ts's "Tote Bag" (Natural canvas)."""
    width = 0.38
    height = 0.42
    depth = 0.10

    # primitive_cube_add(size=1) spans -0.5..0.5 per axis (extent 1), so
    # the final dimension after scaling equals the scale factor directly
    # — scale = (width, depth, height), NOT half those. (First pass here
    # used width/2 etc., assuming the size=2 default's -1..1 convention;
    # wrong for size=1, and confirmed wrong by an actual render showing a
    # body half the intended size with the handles floating beside it
    # instead of overlapping it.)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, height / 2))
    body = bpy.context.active_object
    body.scale = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bpy.ops.object.modifier_add(type="BEVEL")
    body.modifiers["Bevel"].width = 0.012
    body.modifiers["Bevel"].segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")

    handle_span = width * 0.28
    handle_major_r = handle_span / 2
    handle_minor_r = 0.011
    # Real bug, found by checking actual vertex counts, not just the
    # audit score: primitive_torus_add's default orientation is FLAT in
    # the XY plane (a donut lying on a table — Z only varies by
    # minor_radius), not a vertical arch. Two passes here positioned the
    # ring assuming its Z-extent was major+minor (an arch), which it
    # never was — the boolean union genuinely found zero intersection
    # both times (confirmed: vertex count after union == body verts +
    # handle verts exactly, no new/removed vertices, i.e. a real no-op),
    # not a solver failure. Rotating 90° about X swaps the ring's flat
    # plane from XY to XZ — an actual vertical loop, arcing in X (span)
    # and Z (rise), thin in Y (front-to-back) — which is both the
    # visually correct handle shape AND makes the Z-extent genuinely
    # major+minor, matching what ring_center_z below assumes.
    embed_depth = 0.03
    ring_center_z = height - embed_depth + handle_major_r + handle_minor_r
    for i, side in enumerate((-1, 1)):
        cx = side * width * 0.22
        bpy.ops.mesh.primitive_torus_add(
            major_radius=handle_major_r, minor_radius=handle_minor_r,
            location=(cx, 0, ring_center_z),
            rotation=(math.radians(90), 0, 0),
            major_segments=24, minor_segments=8,
        )
        handle = bpy.context.active_object
        handle.name = f"handle_{i}"

        mod = body.modifiers.new(name=f"union_handle_{i}", type="BOOLEAN")
        mod.operation = "UNION"
        mod.object = handle
        mod.solver = "EXACT"
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=mod.name)

        bpy.data.objects.remove(handle, do_unlink=True)

    mat = new_material("tote_material", (0.85, 0.80, 0.68, 1.0), roughness=0.9, metallic=0.0)
    return finish_object(body, "tote_body", mat, weld=True)


MODELS = {
    "bottle": model_bottle,
    "tote": model_tote,
}


def export_glb(obj, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        use_selection=True,
        export_format="GLB",
        export_yup=True,
    )


if __name__ == "__main__":
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    if not argv or argv[0] not in MODELS:
        print(f"Usage: blender --background --python {sys.argv[0]} -- <{'|'.join(MODELS)}>")
        sys.exit(1)

    product = argv[0]
    clear_scene()
    obj = MODELS[product]()
    out_path = f"assets/needs-review/{product}.glb"
    export_glb(obj, out_path)
    print(f"Exported: {out_path}")
