#!/usr/bin/env python3
"""PupsonStuff PILOT.08: Blender CPU fallback for a *measured* blank tote.

No GPU, external downloads, model checkpoints or extra vendor API required.
Inspection mode works without Blender installed. Source manifest, operator
measurement evidence and manual approval are ALWAYS prerequisites to export.
Export is a NEW quarantine GLB, never the approved storefront model.

 blender -b --python scripts/model_supplier_tote_blender.py -- \
   --pack /private/source-packs/tote \
   --output /private/quarantine/tote-cpu-01.glb \
   --write-quarantine --approval-file /private/approvals/tote-cpu.json
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

from factory_source_pack import source_path,verify_pack,sha256_file
from procedural_tote_geometry import build_geometry,measured_bounds,validate_tote_dimensions

MAX_BYTES=10*1024*1024
MAX_TRIANGLES=120_000


def inspect(pack, output):
    root=Path(pack).expanduser().resolve(strict=True)
    manifest_path=source_path(root,"manifest.json")
    manifest=json.loads(manifest_path.read_text("utf8"))
    receipt=verify_pack(root,manifest,for_execution=True)
    problems=list(receipt["blockers"])
    if manifest.get("productId")!="tote":
        problems.append("ONLY_TOTE_CPU_FALLBACK_SUPPORTED")
    if manifest.get("generator") != "pupson-procedural-tote-cpu":
        problems.append("CPU_PROCEDURAL_SOURCE_PROVENANCE_REQUIRED")
    spec=manifest.get("proceduralTote")
    geom=None
    try:
        validate_tote_dimensions(spec,manifest.get("dimensionsMm"))
        geom=build_geometry(manifest["dimensionsMm"],spec)
        if len(geom["faces"]) > MAX_TRIANGLES:
            problems.append("MODEL_TRIANGLE_BUDGET_EXCEEDED")
    except (ValueError,TypeError) as e:
        problems.append("TOTE_DIMENSION_PROFILE_INVALID:"+str(e))
    dest=Path(output).expanduser().resolve()
    if "quarantine" not in dest.parts or dest.suffix.lower()!=".glb":
        problems.append("OUTPUT_MUST_BE_QUARANTINED_GLB")
    if dest.exists():
        problems.append("CANDIDATE_OUTPUT_EXISTS")
    if any(part in dest.parts for part in ("public","approved")):
        problems.append("ACTIVE_ASSET_PATH_FORBIDDEN")
    return manifest_path,geom,{
        "candidateReadyForManualExport":not problems,
        "blockers":sorted(set(problems)),
        "triangles":len(geom["faces"]) if geom else None,
        "boundsMetersBlenderXYZ":measured_bounds(geom) if geom else None,
        "storefrontApproved":False,"physicalSampleVerified":False,
        "operatorRenderRequired":True,
    }


def verify_approval(path,manifest_path):
    if not path:
        raise ValueError("EXPLICIT_CPU_EXPORT_APPROVAL_REQUIRED")
    approved=json.loads(Path(path).read_text("utf8"))
    if approved.get("enabled") is not True or approved.get("model")!="measured-tote-cpu-v1" or (
        approved.get("manifestSha256") != sha256_file(manifest_path)
    ) or approved.get("ownerCpuComputeNoBilling") is not True or not isinstance(
        approved.get("approvedBy"),str
    ) or len(approved["approvedBy"].strip()) < 4:
        raise ValueError("CPU_EXPORT_APPROVAL_RECEIPT_INVALID")
    return approved


def save_blender_mesh(geometry,path):
    try:
        import bpy
        import bmesh
    except ImportError as error:
        raise RuntimeError("BLENDER_BPY_NOT_AVAILABLE_NO_EXPORT") from error
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh=bpy.data.meshes.new("measured-tote-candidate")
    mesh.from_pydata(geometry["vertices"],[],geometry["faces"])
    mesh.update(calc_edges=True)
    bm=bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    uv_layer=mesh.uv_layers.new(name="product-uv")
    for polygon in mesh.polygons:
        for loop_id in polygon.loop_indices:
            loop=mesh.loops[loop_id]
            uv_layer.data[loop_id].uv=geometry["uv"][loop.vertex_index]
        polygon.use_smooth=True
    material=bpy.data.materials.new("tote_material")
    material.use_nodes=True
    nodes=material.node_tree.nodes
    pbr=nodes.get("Principled BSDF")
    pbr.inputs["Base Color"].default_value=(0.69,0.63,0.51,1)
    pbr.inputs["Metallic"].default_value=0
    pbr.inputs["Roughness"].default_value=0.88
    mesh.materials.append(material)
    obj=bpy.data.objects.new("tote_body",mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(
        filepath=str(path),export_format="GLB",export_yup=True,use_selection=True)
    if path.stat().st_size<256 or path.stat().st_size>MAX_BYTES:
        path.unlink(missing_ok=True)
        raise ValueError("EXPORTED_MODEL_OUTSIDE_MOBILE_SIZE_BUDGET")


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--pack",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--write-quarantine",action="store_true")
    parser.add_argument("--approval-file",default=None)
    av=argv if argv is not None else (
        sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    )
    args=parser.parse_args(av)
    manifest_path,geometry,report=inspect(args.pack,args.output)
    report["mode"]="quarantine-export-request" if args.write_quarantine else "dry-run"
    print(json.dumps(report,indent=2,sort_keys=True))
    if not args.write_quarantine:
        return 0 if report["candidateReadyForManualExport"] else 2
    if not report["candidateReadyForManualExport"]:
        raise SystemExit("SOURCE_PACK_OR_DIMENSIONS_NOT_VERIFIED_NO_EXPORT")
    verify_approval(args.approval_file,manifest_path)
    target=Path(args.output).expanduser().resolve()
    target.parent.mkdir(parents=True,exist_ok=True)
    # The filesystem check above is advisory. Exclusive reservation protects
    # against an accidental concurrent output overwrite before Blender export.
    with target.open("xb"):
        pass
    try:
        save_blender_mesh(geometry,target)
        if not target.exists():
            raise ValueError("EXPORT_NOT_FOUND")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    evidence={
        "status":"QUARANTINED_UNAPPROVED",
        "sourceManifestSha256":sha256_file(manifest_path),
        "glbSha256":sha256_file(target),
        "triangles":len(geometry["faces"]),
        "boundsBlenderXYZ":measured_bounds(geometry),
        "printMasterApproved":False,"storefrontApproved":False,
        "pending":["verify GLB geometry/normals and UVs",
                   "compare physical supplier front/side/back",
                   "assess real Printify print area and mobile previews",
                   "physical sample signoff"],
    }
    target.with_suffix(".review.json").write_text(
        json.dumps(evidence,indent=2)+"\n",encoding="utf8"
    )
    print(json.dumps(evidence,indent=2))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
