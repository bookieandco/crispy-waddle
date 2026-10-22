#!/usr/bin/env python3
"""PupsonStuff GENERATE.05: report existing audited GLB vs a candidate.

Numbers are original geometry evidence, NOT automated proof of visual
likeness, Printify certification, customer-photo safety or physical sampling.
No IO other than reading local audit JSON and printing an immutable report.
"""
import argparse
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS = {"tote", "hoodie", "mug", "shirt", "pillow", "bottle"}


def report_for(product, old, proposed=None):
    if product not in PRODUCTS:
        raise ValueError("UNKNOWN_PRODUCT")
    if old.get("assetId") != product:
        raise ValueError("BASELINE_PRODUCT_ID_MISMATCH")
    if proposed is not None and proposed.get("assetId") not in (
        product, f"{product}-candidate", f"{product}-candidate-01"
    ):
        raise ValueError("CANDIDATE_ID_NOT_FOR_PRODUCT")
    metrics = lambda x: {
        "sourceFile": x.get("sourceFile"), "fileSizeBytes": x.get("fileSizeBytes"),
        "triangles": x.get("geometry", {}).get("triangleCount"),
        "vertices": x.get("geometry", {}).get("vertexCount"),
        "textureCount": x.get("geometry", {}).get("textureCount"),
        "geometryIssues": x.get("geometry", {}).get("issues", []),
        "watertight": x.get("geometry", {}).get("topology", {}).get("watertight"),
        "materialIssues": x.get("materials", {}).get("issues", []),
        "boundsAsExported": x.get("geometry", {}).get("boundingBox", {}).get("dimensions"),
    }
    return {
        "status": "NEEDS_REAL_SKU_AND_VISUAL_COMPARISON",
        "productId": product,
        "approvedBaseline": metrics(old),
        "candidate": metrics(proposed) if proposed else None,
        "realPrintifyDimensionsVerified": False,
        "frontSideBackPhysicalReferencesVerified": False,
        "mobileCandidateScreenshotsReviewed": False,
        "decalAgainstRealVendorPrintZoneVerified": False,
        "physicalSampleApproved": False,
        "storefrontApproved": False,
        "qualityDecision": "UNASSESSED",
        "missingExternalEvidence": [
            "exact supplier blueprint / print provider / variant and measured SKU",
            "rights-cleared product reference photos in front/side/back",
            "actual generated model or physically modeled source candidate",
            "same-camera screenshot/physical silhouette inspection",
            "UV/artwork zone alignment and live sample signoff",
        ],
        "note": "Geometry counts and renderer loadability cannot certify professional physical likeness."
    }


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", choices=sorted(PRODUCTS), required=True)
    parser.add_argument("--candidate-audit", default=None)
    args = parser.parse_args(argv)
    root = ROOT / "asset-audits" / "reports"
    baseline = json.loads((root / f"{args.product}.json").read_text("utf8"))
    candidate = None
    if args.candidate_audit is not None:
        p = Path(args.candidate_audit).resolve(strict=True)
        if "quarantine" not in p.parts:
            raise ValueError("CANDIDATE_AUDIT_MUST_BE_QUARANTINED")
        candidate = json.loads(p.read_text("utf8"))
    print(json.dumps(report_for(args.product, baseline, candidate), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
