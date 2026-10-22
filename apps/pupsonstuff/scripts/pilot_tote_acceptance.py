#!/usr/bin/env python3
"""PUPSON-3D.FACTORY.PILOT.10: source-aware acceptance ledger.

All reads are private/local. Never promotes, publishes, changes Printify, or
uses customer media. Candidate GLB bytes and six Blender renders must exist
before any acceptance. Even passing technical GLB checks never supplies vendor
dimensions, actual printed sample approval or physical iPhone sign-off.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

from factory_source_pack import verify_pack,source_path,sha256_file
from pilot_tote_glb import MAX_GLB_BYTES
from procedural_tote_geometry import validate_tote_dimensions

VIEWS=("front","side","back")


def parse_glb(blob):
    if len(blob)<256 or len(blob)>MAX_GLB_BYTES or blob[:4]!=b"glTF":
        raise ValueError("GLB_V2_BUDGET_OR_MAGIC_INVALID")
    magic,version,total=struct.unpack("<4sII",blob[:12])
    if version!=2 or total!=len(blob): raise ValueError("GLB_V2_LENGTH_OR_VERSION_INVALID")
    json_len,kind=struct.unpack("<I4s",blob[12:20])
    if kind!=b"JSON" or not 2<=json_len<=len(blob)-20:
        raise ValueError("GLB_JSON_CHUNK_INVALID")
    j=json.loads(blob[20:20+json_len])
    if len(j.get("meshes",[]))!=1:
        raise ValueError("CURRENT_VIEWER_REQUIRES_EXACTLY_ONE_MESH")
    mesh=j["meshes"][0]
    if len(mesh.get("primitives",[]))!=1:
        raise ValueError("CURRENT_VIEWER_REQUIRES_EXACTLY_ONE_PRIMITIVE")
    prim=mesh["primitives"][0]
    if not {"POSITION","NORMAL","TEXCOORD_0"}<=set(prim.get("attributes",{})):
        raise ValueError("GLB_REQUIRES_NORMALS_AND_UV")
    if len(j.get("materials",[]))!=1:
        raise ValueError("CURRENT_VIEWER_REQUIRES_ONE_MATERIAL")
    if j["materials"][0].get("name")!="tote_material":
        raise ValueError("EXPECTED_TOTE_VIEWER_MATERIAL_MISSING")
    if not any(node.get("name")=="tote_body" for node in j.get("nodes",[])):
        raise ValueError("EXPECTED_TOTE_VIEWER_MESH_MISSING")
    a=j["accessors"][prim["attributes"]["POSITION"]]
    minv=a.get("min")
    maxv=a.get("max")
    if not isinstance(minv,list) or not isinstance(maxv,list) or len(minv)!=3 or len(maxv)!=3:
        raise ValueError("GLB_BOUNDS_MISSING")
    bounds=[maxv[i]-minv[i] for i in range(3)]
    if any(not isinstance(d,(int,float)) or d<=0 for d in bounds):
        raise ValueError("GLB_BOUNDS_INVALID")
    tri=j["accessors"][prim["indices"]]["count"]//3
    if tri<=0 or tri>120000:
        raise ValueError("GLB_TRIANGLE_BUDGET_INVALID")
    return {"dimensionsMetersYUp":bounds,
            "triangles":tri,"material":"tote_material","mesh":"tote_body",
            "mobileBytes":len(blob)}

def check_quality(pack,candidate,comparison_dir,review=None):
    root=Path(pack).resolve(strict=True)
    manifest_file=source_path(root,"manifest.json")
    manifest=json.loads(manifest_file.read_text("utf8"))
    source=verify_pack(root,manifest,for_execution=True)
    blockers=list(source["blockers"])
    c=Path(candidate).resolve()
    q=Path(comparison_dir).resolve()
    if "quarantine" not in c.parts or "quarantine" not in q.parts or c.suffix.lower()!=".glb":
        blockers.append("CANDIDATE_AND_COMPARISON_MUST_STAY_PRIVATE_QUARANTINE")
    if not c.is_file():
        blockers.append("REAL_CANDIDATE_GLB_NOT_GENERATED")
    if not q.is_dir():
        blockers.append("BASELINE_AND_CANDIDATE_SCREENSHOTS_NOT_RENDERED")
    details=None
    if c.is_file() and "quarantine" in c.parts:
        try:
            details=parse_glb(c.read_bytes())
            if manifest.get("productId")!="tote":
                blockers.append("UNEXPECTED_PRODUCT")
            try:
                validate_tote_dimensions(manifest.get("proceduralTote"),manifest.get("dimensionsMm"))
                measured=manifest["dimensionsMm"]
                expected=[measured[0]/1000,measured[1]/1000,measured[2]/1000]
                actual=details["dimensionsMetersYUp"]
                if any(abs(actual[i]-expected[i])/expected[i]>.07 for i in range(3)):
                    blockers.append("GLB_DIMENSIONS_DIFFER_FROM_VERIFIED_SKU")
            except (TypeError,ValueError,KeyError):
                blockers.append("REAL_SUPPLIER_MEASUREMENT_EVIDENCE_MISSING")
        except (ValueError,KeyError,UnicodeDecodeError) as e:
            blockers.append("CANDIDATE_GLB_TECHNICAL_AUDIT_FAILED:"+str(e))
    sha=sha256_file(c) if c.is_file() else None
    screenshots={}
    if q.is_dir():
        for role in ("candidate","approved"):
            for view in VIEWS:
                path=q/f"{role}-{view}.png"
                try:
                    if path.is_symlink() or not path.is_file() or not 1024<path.stat().st_size<10*1024*1024:
                        raise ValueError("not present")
                    if path.open("rb").read(8)!=b"\x89PNG\r\n\x1a\n":
                        raise ValueError("not PNG")
                    screenshots[role+"-"+view]=sha256_file(path)
                except (ValueError,OSError):
                    blockers.append("SIX_REAL_BLENDER_SCREENSHOTS_REQUIRED:"+role+"-"+view)
    # Distinct human signoffs; never infer them from a CI job or a placeholder.
    gates=("supplierSkuMeasurementsPersonallyReviewed",
           "frontSideBackLicensedReferenceCompared",
           "faceAndHandleSilhouetteAccepted",
           "candidateUvAndArtworkFrontOnlyApproved",
           "physicalPrintifySampleApproved",
           "physicalIphoneSafariApproved")
    approvals=review if isinstance(review,dict) else {}
    for field in gates:
        if approvals.get(field) is not True:
            blockers.append("MANUAL_SIGNOFF_REQUIRED:"+field)
    if approvals.get("candidateSha256")!=sha or not sha:
        blockers.append("CANDIDATE_SHA_NOT_ATTESTED")
    if len(screenshots)!=6 or approvals.get("screenshotsSha256")!=screenshots:
        blockers.append("SIX_SCREENSHOT_HASHES_NOT_SIGNED_OFF")
    # The package deliberately NEVER writes a production asset or catalog.
    return {"status":"NOT_APPROVED" if blockers else "READY_FOR_SEPARATE_RELEASE_REVIEW",
            "blockingReasons":sorted(set(blockers)),
            "candidateSha256":sha,"technicalGlb":details,"screenshotSha256":screenshots,
            "storefrontApproved":False,"canPlaceOrders":False,
            "mayPromoteAutomatically":False}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--pack",required=True)
    p.add_argument("--candidate",required=True)
    p.add_argument("--comparison",required=True)
    p.add_argument("--signed-review")
    a=p.parse_args()
    review=json.loads(Path(a.signed_review).read_text("utf8")) if a.signed_review else None
    print(json.dumps(check_quality(a.pack,a.candidate,a.comparison,review),indent=2))
    # Report-only: caller never interprets exit 0 as approved.
if __name__=="__main__":
    main()
