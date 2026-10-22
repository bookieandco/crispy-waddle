#!/usr/bin/env python3
"""PupsonStuff GENERATE.01: offline physical-SKU source intake.

Does not contact Printify, download images, run inference, or upload files.
Only a LOCAL operator-supplied reference pack can pass the preparation gate.
All paths must be contained in the supplied, non-symlink source-pack directory.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

MAX_INPUT_BYTES = 15 * 1024 * 1024
VALID_NAME = re.compile(r"^[a-z][a-z0-9-]{1,63}$")
GENERATOR_IDS = frozenset({
    "tencent-hunyuan3d-2", "aiuniai-unique3d",
    "ashawkey-stable-dreamfusion", "microsoft-trellis",
    "microsoft-trellis2", "pupson-procedural-tote-cpu",
})
VIEWS = ("front", "side", "back")


def sha256_file(path):
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def read_image(path):
    if not path.is_file() or path.stat().st_size <= 128 or path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("IMAGE_MISSING_OR_SIZE_INVALID")
    with path.open("rb") as f:
        header = f.read(16)
    if path.suffix.lower() == ".png" and header.startswith(b"\x89PNG\r\n\x1a\n"):
        return
    if path.suffix.lower() in (".jpg", ".jpeg") and header.startswith(b"\xff\xd8\xff"):
        return
    raise ValueError("IMAGE_CONTENT_OR_FORMAT_INVALID")


def source_path(root, filename):
    if not isinstance(filename, str) or not filename or Path(filename).is_absolute():
        raise ValueError("REFERENCE_PATH_INVALID")
    rel = Path(filename)
    if ".." in rel.parts or any(part.startswith(".") for part in rel.parts):
        raise ValueError("REFERENCE_PATH_INVALID")
    candidate = root / rel
    if candidate.is_symlink() or candidate.resolve(strict=True).is_relative_to(root) is False:
        raise ValueError("REFERENCE_OUTSIDE_PACK_OR_SYMLINK")
    return candidate


def verify_pack(root, manifest, for_execution=False):
    """Returns explicit blockers, not an authorization or storefront approval."""
    blockers, evidence = [], {}
    if not isinstance(manifest, dict):
        return {"prepared": False, "executable": False, "blockers": ["MANIFEST_NOT_OBJECT"]}
    product = manifest.get("productId")
    candidate = manifest.get("candidateId")
    if not all(isinstance(x, str) and VALID_NAME.fullmatch(x) for x in (product, candidate)):
        blockers.append("PRODUCT_OR_CANDIDATE_ID_INVALID")
    if manifest.get("generator") not in GENERATOR_IDS:
        blockers.append("GENERATOR_NOT_CANONICAL")
    if manifest.get("sourceKind") not in ("operator-owned-reference", "synthetic"):
        blockers.append("UNSUPPORTED_INPUT_KIND")
    if manifest.get("sourceKind") == "synthetic" and for_execution:
        blockers.append("SYNTHETIC_REFS_NOT_PHYSICAL_SKU_PROOF")
    # We accept neither a product nickname nor a placeholder as a vendor SKU.
    supplier = manifest.get("supplier")
    sku = manifest.get("supplierSku")
    if supplier != "Printify" or not isinstance(sku, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_:\-]{3,99}", sku) or "placeholder" in sku.lower():
        blockers.append("REAL_PRINTIFY_VARIANT_REQUIRED")
    # The Printify lookup is an *exact* blueprint / provider / variant
    # read-only snapshot from our canonical client, not a placeholder SKU.
    for key in ("blueprintId", "printProviderId", "variantId"):
        v = manifest.get(key)
        if type(v) is not int or v <= 0:
            blockers.append("PRINTIFY_" + key.upper() + "_REQUIRED")
    evidence_file = manifest.get("printifyCatalogEvidence")
    evidence_digest = manifest.get("printifyCatalogEvidenceSha256")
    if not isinstance(evidence_file, str) or not isinstance(evidence_digest, str) or not re.fullmatch(r"[a-f0-9]{64}", evidence_digest):
        blockers.append("EXACT_PRINTIFY_CATALOG_SNAPSHOT_REQUIRED")
    else:
        try:
            evidence_path = source_path(root, evidence_file)
            if evidence_path.stat().st_size > 256 * 1024 or sha256_file(evidence_path) != evidence_digest:
                blockers.append("PRINTIFY_CATALOG_SNAPSHOT_HASH_INVALID")
            else:
                catalog = json.loads(evidence_path.read_text("utf8"))
                same_ids = isinstance(catalog, dict) and all(
                    catalog.get(k) == manifest.get(k) for k in (
                        "blueprintId", "printProviderId", "variantId"
                    )
                )
                if (not isinstance(catalog, dict) or
                    catalog.get("authority") != "PRINTIFY_CATALOG_READ_ONLY" or
                    catalog.get("product") != product or
                    catalog.get("storefrontApproved") is not False or
                    not same_ids or not isinstance(catalog.get("printAreasPx"), list) or
                    len(catalog["printAreasPx"]) < 1):
                    blockers.append("PRINTIFY_EXACT_VARIANT_OR_PRINT_ZONE_NOT_PROVED")
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            blockers.append("PRINTIFY_CATALOG_SNAPSHOT_INVALID:" + str(exc))
    dimensions = manifest.get("dimensionsMm")
    if not isinstance(dimensions, list) or len(dimensions) != 3 or any(
        type(x) not in (float, int) or not 0 < x <= 3000 for x in dimensions
    ):
        blockers.append("REAL_SKU_WIDTH_HEIGHT_DEPTH_REQUIRED")
    common_rights = ("skuMeasurementEvidence", "photoRightsEvidence", "outputCommercialRightsEvidence")
    model_rights = () if manifest.get("generator") == "pupson-procedural-tote-cpu" else (
        "checkpointLicenseEvidence", "dependencyLicenseEvidence", "generatorRevision"
    )
    for field in common_rights + model_rights:
        val = manifest.get(field)
        if not isinstance(val, str) or len(val.strip()) < 12 or "placeholder" in val.lower() or "todo" in val.lower():
            blockers.append(field.upper() + "_MISSING")
    if manifest.get("generator") == "pupson-procedural-tote-cpu" and product != "tote":
        blockers.append("CPU_PROCEDURAL_SOURCE_TOTE_ONLY")
    if manifest.get("generator") == "tencent-hunyuan3d-2" and not (
        isinstance(manifest.get("hunyuanTerritoryClearance"), str) and
        len(manifest["hunyuanTerritoryClearance"].strip()) >= 20
    ):
        blockers.append("HUNYUAN_TERRITORY_COMMERCIAL_TERMS_UNCLEARED")
    ref = manifest.get("references")
    if not isinstance(ref, dict):
        blockers.append("REFERENCE_VIEWS_MISSING")
    else:
        for angle in VIEWS:
            info = ref.get(angle)
            if not isinstance(info, dict):
                blockers.append("REFERENCE_" + angle.upper() + "_MISSING")
                continue
            pathstr, expected = info.get("file"), info.get("sha256")
            if not isinstance(expected, str) or not re.fullmatch(r"[a-f0-9]{64}", expected):
                blockers.append("REFERENCE_" + angle.upper() + "_SHA_REQUIRED")
                continue
            try:
                image = source_path(root, pathstr)
                read_image(image)
                digest = sha256_file(image)
                if digest != expected:
                    blockers.append("REFERENCE_" + angle.upper() + "_HASH_MISMATCH")
                else:
                    evidence[angle] = {"sha256": digest, "bytes": image.stat().st_size,
                                       "relativeFile": pathstr}
            except (OSError, ValueError) as exc:
                blockers.append("REFERENCE_" + angle.upper() + "_INVALID:" + str(exc))
    return {"prepared": not blockers, "executable": not blockers and for_execution,
            "blockers": sorted(set(blockers)), "images": evidence,
            "storefrontApproved": False, "needsPhysicalSampleAndPrintZoneSignoff": True}


def run(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", required=True)
    ap.add_argument("--manifest", default="manifest.json")
    ap.add_argument("--for-execution", action="store_true")
    options = ap.parse_args(argv)
    root = Path(options.pack).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("PACK_NOT_DIRECTORY")
    path = source_path(root, options.manifest)
    report = verify_pack(root, json.loads(path.read_text("utf8")), options.for_execution)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["prepared"] else 2


if __name__ == "__main__":
    raise SystemExit(run())
