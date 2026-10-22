#!/usr/bin/env python3
"""Assemble the real PupsonStuff tote source pack from PRIVATE operator files.

Defaults to report-only. Does not contact providers, order samples, generate
assets, infer vendor measurements, alter Supabase, or publish preview files.
The output manifest is *source evidence*, not a product or rights certificate.

Folder layout (private machine, outside public GitHub):
  intake.json                     operator-measured specs and SKU selection
  printify-catalog.json           read-only output from printify:sku3d
  measurement-source.pdf          physical measurements/technical specification
  commercial-usage-license.pdf   rights to resulting production previews
  blank-photo-rights.pdf          permission to use blank photos in modeling
  merchant-selection.json         owner-confirmed exact blueprint/provider/variant
  front.png, side.png, back.png    owner-permitted blank reference angles

Example:
 python3 scripts/assemble_tote_source_pack.py --pack /private/tote
 python3 scripts/assemble_tote_source_pack.py --pack /private/tote --write-manifest

Neither the source pack nor images/Printify token should be committed into a
public GitHub repo. This command NEVER approves physical sample or deployment.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re

from factory_source_pack import source_path, sha256_file, verify_pack
from procedural_tote_geometry import validate_tote_dimensions

SOURCE_DOC_KEYS={
 "manufacturerMeasurementsFile":"skuMeasurementEvidence",
 "blankPhotoRightsFile":"photoRightsEvidence",
 "commercialDerivativeRightsFile":"outputCommercialRightsEvidence",
}
REFERENCE_ANGLES=("front","side","back")
MAX_DOC_SIZE=5*1024*1024
MIN_DOC_SIZE=20


def read_json(root,name):
    path=source_path(root,name)
    if not path.is_file() or path.stat().st_size>256*1024:
        raise ValueError("PRIVATE_JSON_FILE_MISSING_OR_TOO_LARGE:"+name)
    data=json.loads(path.read_text("utf8"))
    if not isinstance(data,dict):
        raise ValueError("EXPECTED_JSON_OBJECT:"+name)
    return data,path


def document_receipt(root,name):
    path=source_path(root,name)
    if not path.is_file() or not MIN_DOC_SIZE<=path.stat().st_size<=MAX_DOC_SIZE:
        raise ValueError("DOCUMENT_MISSING_OR_OUTSIDE_SIZE_LIMIT:"+name)
    return "private-evidence-sha256:"+sha256_file(path)


def compile_private_manifest(root):
    """Return manifest and blockers; no persistent writes, no inferred SKU."""
    root=Path(root).expanduser().resolve(strict=True)
    blockers=[]
    template_path=(Path(__file__).resolve().parent.parent/
      "docs/asset-factory/source-packs/tote.manifest.template.json")
    manifest=json.loads(template_path.read_text("utf8"))
    if not root.is_dir(): raise ValueError("PRIVATE_PACK_DIRECTORY_REQUIRED")
    try:
        intake,_=read_json(root,"intake.json")
    except (ValueError,OSError,json.JSONDecodeError) as e:
        return manifest,["OPERATOR_INTAKE_REQUIRED:"+str(e)]
    # The catalog receipt is supplied by the operator and hash-locked; the
    # assembler does not cryptographically verify the original API response.
    try:
        catalog,catalog_path=read_json(root,"printify-catalog.json")
        if (catalog.get("authority")!="PRINTIFY_CATALOG_READ_ONLY" or
            catalog.get("product")!="tote" or
            not isinstance(catalog.get("printAreasPx"),list) or
            not catalog["printAreasPx"] or
            any(type(catalog.get(k)) is not int or catalog[k]<=0 for k in
                ("blueprintId","printProviderId","variantId"))):
            raise ValueError("EXACT_API_CATALOG_RECEIPT_REQUIRED")
        manifest.update({
            "blueprintId":catalog["blueprintId"],
            "printProviderId":catalog["printProviderId"],
            "variantId":catalog["variantId"],
            "printifyCatalogEvidence":"printify-catalog.json",
            "printifyCatalogEvidenceSha256":sha256_file(catalog_path),
        })
        selection,_=read_json(root,"merchant-selection.json")
        if (selection.get("ownerConfirmedForPupsonstuff") is not True or
            any(selection.get(k)!=catalog[k] for k in
                ("blueprintId","printProviderId","variantId")) or
            not isinstance(selection.get("selectedSku"),str) or
            not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_:\-]{3,99}",
                            selection["selectedSku"]) or
            not isinstance(selection.get("selectedBy"),str) or
            len(selection["selectedBy"].strip())<4):
            raise ValueError("OWNER_SELECTION_NOT_TIED_TO_EXACT_CATALOG_VARIANT")
        manifest["supplierSku"]=selection["selectedSku"]
    except (ValueError,KeyError,TypeError,OSError,json.JSONDecodeError) as e:
        blockers.append("EXACT_AUTHENTICATED_CATALOG_AND_OWNER_SELECTION_REQUIRED:"+str(e))
    # Public Printify thickness is often FLAT bag thickness, not physical
    # gusset depth. This requires a documented manufacturer/sample 3D depth.
    physical=intake.get("physical")
    if not isinstance(physical,dict):
        blockers.append("REAL_PHYSICAL_MEASUREMENTS_REQUIRED")
    else:
        dims=physical.get("dimensionsMm")
        profile=physical.get("proceduralTote")
        if physical.get("depthBasis") not in (
            "manufacturer-3d-depth","sample-measured-3d-depth"):
            blockers.append("ACTUAL_3D_DEPTH_SOURCE_REQUIRED_NO_FLAT_THICKNESS_INFERENCE")
        if (not isinstance(physical.get("measuredVariant"),str) or
            len(physical["measuredVariant"].strip())<5):
            blockers.append("MEASURED_PRODUCT_VARIANT_NOT_IDENTIFIED")
        manifest["dimensionsMm"]=dims
        manifest["proceduralTote"]=dict(profile) if isinstance(profile,dict) else profile
    if not isinstance(intake.get("ownerReviewedRights"),bool) or (
        intake.get("ownerReviewedRights") is not True):
        blockers.append("OWNER_REVIEWED_PHOTO_AND_DERIVATIVE_RIGHTS_REQUIRED")
    for filename_key,manifest_key in SOURCE_DOC_KEYS.items():
        filename=intake.get(filename_key)
        if not isinstance(filename,str):
            blockers.append("DOCUMENT_FIELD_REQUIRED:"+filename_key)
            continue
        try:
            manifest[manifest_key]=document_receipt(root,filename)
            if manifest_key=="skuMeasurementEvidence" and isinstance(
                  manifest.get("proceduralTote"),dict):
                manifest["proceduralTote"]["measurementEvidence"]=manifest[manifest_key]
        except (OSError,ValueError) as e:
            blockers.append("DOCUMENT_INVALID:"+filename_key+":"+str(e))
    for angle in REFERENCE_ANGLES:
        # fixed file names and in-pack bounds; no downloading or license claim.
        entry=intake.get("references",{}).get(angle) if isinstance(
              intake.get("references"),dict) else None
        if not isinstance(entry,str):
            blockers.append("LICENSED_"+angle.upper()+"_REFERENCE_REQUIRED")
            continue
        try:
            path=source_path(root,entry)
            if path.suffix.lower() not in (".png",".jpg",".jpeg"):
                raise ValueError("NOT_AN_ALLOWED_IMAGE_EXTENSION")
            if not path.is_file():
                raise ValueError("IMAGE_NOT_FOUND")
            manifest["references"][angle]={"file":entry,"sha256":sha256_file(path)}
        except (OSError,ValueError) as e:
            blockers.append("REFERENCE_FILE_INVALID:"+angle.upper()+":"+str(e))
    # Validate only AFTER measurement-source file is hashed into the
    # geometry evidence; operator input cannot simply self-certify this hash.
    try:
        validate_tote_dimensions(manifest.get("proceduralTote"),
                                 manifest.get("dimensionsMm"))
    except (TypeError,ValueError) as e:
        blockers.append("HANDLE_BODY_MEASUREMENTS_INVALID:"+str(e))
    # Prevent template documentation keys from leaking into production pack.
    manifest.pop("_instructions",None)
    manifest.pop("publicReferenceOnly",None)
    manifest["productId"]="tote"
    manifest["sourceKind"]="operator-owned-reference"
    manifest["generator"]="pupson-procedural-tote-cpu"
    # 'prepared' checks file syntax and self-attested rights only, NOT vendor
    # truth, physical likeness, real sample printing, or a shop publication.
    if not blockers:
        result=verify_pack(root,manifest,for_execution=True)
        blockers.extend(result["blockers"])
    return manifest,sorted(set(blockers))


def run(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--pack",required=True)
    parser.add_argument("--write-manifest",action="store_true")
    args=parser.parse_args(argv)
    root=Path(args.pack).expanduser().resolve(strict=True)
    manifest,blockers=compile_private_manifest(root)
    report={"status":"BLOCKED_SOURCE_PACK" if blockers else
                      "SOURCE_PACKET_STRUCTURALLY_READY_NOT_MANUFACTURER_CERTIFIED",
            "blockers":blockers,"manifestWillBeWritten":False,
            "storefrontApproved":False,"physicalSampleApproved":False,
            "privateHostedPreviewApproved":False,
            "operatorCatalogReceiptIsNotCryptographicProviderSignature":True}
    if args.write_manifest and not blockers:
        outfile=root/"manifest.json"
        # No overwrite. Even an existing pack must be handled explicitly to
        # protect an already reviewed manifest hash and model provenance.
        with outfile.open("x",encoding="utf8") as f:
            json.dump(manifest,f,indent=2)
            f.write("\n")
        report["manifestWillBeWritten"]=True
        report["manifestSha256"]=sha256_file(outfile)
    print(json.dumps(report,indent=2))
    return 2 if blockers else 0


if __name__=="__main__":
    raise SystemExit(run())
