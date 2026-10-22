#!/usr/bin/env python3
"""Pilot.09: standard-library glTF/GLB writer for the existing measured tote geometry.

Normal production execution requires the same approved Printify source pack as
the Blender path and a separate CPU export receipt. No GPU, hosted models,
network, external Python dependency, customer photos, or asset promotion.

A *separate* CI-only synthetic fixture mode tests actual GLB loadability. Its
dimensions are fictitious and cannot become an approved storefront product.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys

from procedural_tote_geometry import build_geometry,measured_bounds
from model_supplier_tote_blender import inspect,verify_approval
from factory_source_pack import sha256_file

MAX_TRIANGLES=120_000
MAX_GLB_BYTES=10*1024*1024
# Numbers here are test fixture values, not Printify/vendor measurements.
SYNTHETIC_MM=[380,530,95]
SYNTHETIC_PROFILE={
    "bodyHeightMm":390,"handleDropMm":140,
    "strapWidthMm":22,"strapThicknessMm":3,"handleAnchorSpacingMm":145,
    "measurementEvidence":"isolated local QA fixture; fiction only, not vendor evidence",
}

def pad4(data,byte=b"\x00"):
    return data + byte*((-len(data))%4)

def mesh_normals(vertices,faces):
    normals=[[0.0,0.0,0.0] for _ in vertices]
    nondegenerate=0
    for face in faces:
        a,b,c=[vertices[i] for i in face]
        u=[b[i]-a[i] for i in range(3)]
        v=[c[i]-a[i] for i in range(3)]
        cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        length=math.sqrt(sum(x*x for x in cross))
        if length<1e-12:
            continue
        nondegenerate+=1
        for ix in face:
            for d in range(3): normals[ix][d]+=cross[d]
    result=[]
    for n in normals:
        mag=math.sqrt(sum(x*x for x in n))
        result.append(tuple(x/mag for x in n) if mag>1e-12 else (0,1,0))
    return result,nondegenerate

def build_glb(geometry):
    positions=[(float(x),float(z),float(-y)) for x,y,z in geometry["vertices"]]
    faces=geometry["faces"]
    uvs=geometry["uv"]
    if len(positions)<4 or not (len(positions)==len(uvs)) or not (0<len(faces)<=MAX_TRIANGLES):
        raise ValueError("CANDIDATE_GEOMETRY_INVALID")
    if len(positions)>65_535:
        raise ValueError("UNSIGNED_SHORT_VERTEX_LIMIT_EXCEEDED")
    for face in faces:
        if len(face)!=3 or any(type(i)!=int or i<0 or i>=len(positions) for i in face):
            raise ValueError("INVALID_TRIANGLE_INDEX")
    for p in positions:
        if any(not math.isfinite(v) for v in p): raise ValueError("NONFINITE_VERTEX")
    normals,valid=mesh_normals(positions,faces)
    if valid<len(faces)*.99: raise ValueError("DEGENERATE_TRIANGLE_RATIO_HIGH")
    data=bytearray()
    views=[]
    def add(blob,target=None):
        while len(data)%4: data.extend(b"\x00")
        offset=len(data)
        data.extend(blob)
        out={"buffer":0,"byteOffset":offset,"byteLength":len(blob)}
        if target is not None: out["target"]=target
        views.append(out)
        return len(views)-1
    pos_idx=add(b"".join(struct.pack("<fff",*v) for v in positions),34962)
    normal_idx=add(b"".join(struct.pack("<fff",*v) for v in normals),34962)
    uv_idx=add(b"".join(struct.pack("<ff",float(u),float(v)) for u,v in uvs),34962)
    face_idx=add(b"".join(struct.pack("<HHH",*f) for f in faces),34963)
    mins=[min(p[i] for p in positions) for i in range(3)]
    maxs=[max(p[i] for p in positions) for i in range(3)]
    accessors=[
      {"bufferView":pos_idx,"componentType":5126,"count":len(positions),"type":"VEC3","min":mins,"max":maxs},
      {"bufferView":normal_idx,"componentType":5126,"count":len(normals),"type":"VEC3"},
      {"bufferView":uv_idx,"componentType":5126,"count":len(uvs),"type":"VEC2"},
      {"bufferView":face_idx,"componentType":5123,"count":len(faces)*3,"type":"SCALAR"},
    ]
    gltf={
        "asset":{"version":"2.0","generator":"PupsonStuff original CPU tote v1 (unapproved)"},
        "scene":0,"scenes":[{"nodes":[0]}],
        "nodes":[{"mesh":0,"name":"tote_body"}],
        "meshes":[{"name":"tote_body","primitives":[{"attributes":{"POSITION":0,"NORMAL":1,"TEXCOORD_0":2},"indices":3,"material":0}]}],
        "materials":[{"name":"tote_material","pbrMetallicRoughness":{
            "baseColorFactor":[0.74,0.68,0.57,1.0],"metallicFactor":0.0,"roughnessFactor":0.89},
            "doubleSided":True}],
        "buffers":[{"byteLength":len(data)}],"bufferViews":views,"accessors":accessors,
        "extras":{"modelStatus":"QUARANTINE_ONLY","storefrontApproved":False,
                  "printMasterApproved":False,"physicalDimensionsSource":"operator-required"},
    }
    j=pad4(json.dumps(gltf,separators=(",",":"),allow_nan=False).encode("utf8"),b" ")
    b=pad4(bytes(data),b"\x00")
    glb=(struct.pack("<4sII",b"glTF",2,12+8+len(j)+8+len(b))+
         struct.pack("<I4s",len(j),b"JSON")+j+
         struct.pack("<I4s",len(b),b"BIN\x00")+b)
    if len(glb)>MAX_GLB_BYTES: raise ValueError("GLB_EXCEEDS_MOBILE_BUDGET")
    return glb,{"vertexCount":len(positions),"triangleCount":len(faces),
                "nondegenerateTriangles":valid,"boundsYUpMeters":[
                    maxs[i]-mins[i] for i in range(3)],
                "glbBytes":len(glb)}

def blocked_destination(path):
    p=Path(path).expanduser().resolve()
    if p.suffix.lower()!=".glb" or "quarantine" not in p.parts:
        raise ValueError("OUTPUT_MUST_BE_PRIVATE_QUARANTINE_GLB")
    if any(x in p.parts for x in ("approved","public")):
        raise ValueError("NO_PRODUCTION_PUBLIC_ASSET_MUTATION")
    if p.exists(): raise ValueError("REFUSE_EXISTING_OUTPUT")
    return p

def write_exclusive(path,blob):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("xb") as f: f.write(blob)

def generate_from_verified_pack(pack,output,approval,execute=False):
    dest=blocked_destination(output)
    manifest_path,geometry,review=inspect(pack,dest)
    if not review["candidateReadyForManualExport"] or geometry is None:
        return {"status":"BLOCKED_REAL_SUPPLIER_EVIDENCE_REQUIRED",
                "blockers":review["blockers"],"storefrontApproved":False}
    blob,metrics=build_glb(geometry)
    if not execute:
        return {"status":"READY_FOR_SEPARATE_OPERATOR_EXPORT_APPROVAL",
                **metrics,"storefrontApproved":False}
    verify_approval(approval,manifest_path)
    write_exclusive(dest,blob)
    receipt={"status":"QUARANTINE_NEEDS_HUMAN_QA","sha256":hashlib.sha256(blob).hexdigest(),
             "manifestSha256":sha256_file(manifest_path),**metrics,
             "storefrontApproved":False,"sampleCertified":False,
             "printZoneCertified":False,
             "manualReviews":["GLB audit","supplier silhouette","UV/decal front-only",
                              "mobile browser","real printed sample"]}
    dest.with_suffix(".review.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf8")
    return receipt

def write_ci_fixture(path):
    if not (os.environ.get("CI")=="true" and
            os.environ.get("PUPSON_3D_QA_FIXTURE")=="yes" and
            os.environ.get("PUPSON_CLOUDFLARE_PREVIEW_ONLY")=="true"):
        raise ValueError("SYNTHETIC_PREVIEW_MUST_BE_EPHEMERAL_CI_ONLY")
    output=Path(path).resolve()
    # Caller must generate inside this app's ONLY ephemeral local preview path.
    expected=(Path(__file__).resolve().parent.parent/"public"/"qa-pilot-tote.glb").resolve()
    if output!=expected or output.exists():
        raise ValueError("SYNTHETIC_PREVIEW_PATH_NOT_PERMITTED")
    geom=build_geometry(SYNTHETIC_MM,SYNTHETIC_PROFILE)
    blob,metrics=build_glb(geom)
    write_exclusive(output,blob)
    return {"status":"CI_SYNTHETIC_FIXTURE_NOT_PHYSICAL_SKU",
            "sha256":hashlib.sha256(blob).hexdigest(),**metrics,
            "storefrontApproved":False}

def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument("--pack")
    p.add_argument("--output",required=True)
    p.add_argument("--approval-file")
    p.add_argument("--write-quarantine",action="store_true")
    p.add_argument("--ci-synthetic-qa",action="store_true")
    args=p.parse_args(argv)
    if args.ci_synthetic_qa:
        result=write_ci_fixture(args.output)
    elif args.pack:
        result=generate_from_verified_pack(
            args.pack,args.output,args.approval_file,args.write_quarantine)
    else:
        raise ValueError("SOURCE_PACK_REQUIRED_FOR_REAL_MODEL")
    print(json.dumps(result,indent=2))
    return 2 if result["status"].startswith("BLOCKED") else 0

if __name__=="__main__":
    raise SystemExit(main())
