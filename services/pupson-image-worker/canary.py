"""Operator-run real-image canary for the EXISTING private ComfyUI-backed Pupson worker.

Never installs weights, rents GPUs, calls hosted inference or sends source photos
outside the localhost worker. No customer image bytes are included in receipts.
"""
from __future__ import annotations
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from PIL import Image, ImageOps

SUPPORTED = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}
MAX_SOURCE = 10 * 1024 * 1024
MAX_OUTPUT = 20 * 1024 * 1024

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def digest_file(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()

def load_reference(path: Path) -> tuple[bytes, str, str]:
    data = path.read_bytes()
    if not data or len(data) > MAX_SOURCE:
        raise ValueError("REFERENCE_SIZE_INVALID")
    with Image.open(io.BytesIO(data)) as im:
        if im.format not in SUPPORTED or im.width < 512 or im.height < 512:
            raise ValueError("REFERENCE_FORMAT_OR_RESOLUTION_INVALID")
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        fixed = ImageOps.exif_transpose(im)
        out = io.BytesIO()
        fixed.save(out, format="PNG")
    png = out.getvalue()
    if len(png) > MAX_SOURCE:
        raise ValueError("NORMALIZED_REFERENCE_TOO_LARGE")
    return png, "image/png", sha256(data)

def assess_output(data: bytes, *, transparent_expected: bool = False) -> dict:
    if not data or len(data) > MAX_OUTPUT:
        raise ValueError("OUTPUT_SIZE_INVALID")
    with Image.open(io.BytesIO(data)) as im:
        if im.format not in SUPPORTED or im.width < 512 or im.height < 512:
            raise ValueError("OUTPUT_FORMAT_OR_RESOLUTION_INVALID")
        im.load()
        band = im.getchannel("A") if "A" in im.getbands() else None
        has_transparency = bool(band and band.getextrema()[0] < 255)
        if transparent_expected and not has_transparency:
            raise ValueError("TRANSPARENT_OUTPUT_REQUIRED")
        return {"width": im.width, "height": im.height, "format": im.format,
                "hasTransparency": has_transparency, "bytes": len(data), "sha256": sha256(data)}

def refuse_nonlocal(url: str) -> None:
    uri = urlparse(url)
    if uri.scheme != "http" or uri.hostname not in ("127.0.0.1", "localhost", "::1") or uri.username or uri.password or uri.query or uri.fragment or uri.path not in ("", "/"):
        raise ValueError("CANARY_LOOPBACK_WORKER_ONLY")

def run(args: argparse.Namespace) -> dict:
    if not args.execute:
        raise ValueError("CANARY_EXPLICIT_EXECUTION_REQUIRED")
    if not args.commercial_license_attested:
        raise ValueError("MODEL_AND_WORKFLOW_COMMERCIAL_LICENSE_ATTESTATION_REQUIRED")
    refuse_nonlocal(args.worker_url)
    token = os.environ.get("PUPSON_LOCAL_IMAGE_WORKER_TOKEN", "")
    model = os.environ.get("PUPSON_LOCAL_IMAGE_MODEL", "")
    if len(token) < 32 or not model:
        raise ValueError("CANARY_WORKER_CREDENTIALS_AND_MODEL_REQUIRED")
    if len(args.references) not in (1, 2, 3):
        raise ValueError("CANARY_REQUIRES_ONE_TO_THREE_REFERENCES")
    if not args.checkpoint.is_file() or not args.workflow.is_file():
        raise ValueError("CANARY_CHECKPOINT_AND_WORKFLOW_FILES_REQUIRED")
    ref_media = [load_reference(Path(s)) for s in args.references]
    payload = {
        "schema": "pupson.local-image-edit.v1", "engine": "unsloth", "model": model,
        "prompt": args.prompt,
        "reference_images": [{"mime_type": mime, "image_base64": base64.b64encode(blob).decode()}
                             for blob, mime, _ in ref_media]
    }
    request = Request(args.worker_url.rstrip("/") + "/v1/pupson/image/edit",
        data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    started = time.monotonic()
    with urlopen(request, timeout=args.timeout) as response:
        if response.geturl() != args.worker_url.rstrip("/") + "/v1/pupson/image/edit":
            raise ValueError("CANARY_REDIRECT_BLOCKED")
        response_data = response.read(30 * 1024 * 1024 + 1)
    elapsed = time.monotonic() - started
    if len(response_data) > 30 * 1024 * 1024:
        raise ValueError("CANARY_RESPONSE_OVERSIZED")
    body = json.loads(response_data)
    if body.get("schema") != "pupson.local-image-edit-result.v1" or body.get("model") != model:
        raise ValueError("CANARY_SCHEMA_OR_MODEL_MISMATCH")
    output = base64.b64decode(body["image_base64"], validate=True)
    analysis = assess_output(output, transparent_expected=args.transparent)
    # Only hashes, dimensions and timings leave this process. Human/visual QC
    # is deliberately unverified: numerical dimensions cannot prove pet likeness.
    return {
        "schema": "jhadina.local-creative-canary.v1",
        "observedAt": datetime.now(timezone.utc).isoformat(),
        "engine": "comfyui-local", "modelId": model,
        "checkpointSha256": digest_file(args.checkpoint),
        "workflowSha256": digest_file(args.workflow),
        "referenceSha256s": [sha for _, _, sha in ref_media],
        "sourceImageCount": len(ref_media), "elapsedMs": round(elapsed * 1000),
        "output": analysis, "runWasExecuted": True,
        "checkpointCommercialRightsOperatorAttested": True,
        "localOnlyEndpoint": True, "reportedExternalProviderFeeUsd": None,
        "petIdentityVerified": False, "humanPrintReviewPassed": False,
        "note": "Review pet likeness, background edges, variants, and production color before commercial use. Never infer zero electricity, GPU or storage costs."
    }

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", dest="references", action="append", required=True)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--workflow", required=True, type=Path)
    parser.add_argument("--worker-url", default="http://127.0.0.1:8789")
    parser.add_argument("--prompt", default="Preserve this dog's unique fur, facial markings, eyes and ears; produce a faithful professional pet portrait.")
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--transparent", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--commercial-license-attested", action="store_true")
    parser.add_argument("--receipt-file", type=Path, required=True)
    args = parser.parse_args()
    result = run(args)
    args.receipt_file.parent.mkdir(parents=True, exist_ok=True)
    args.receipt_file.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("CANARY_RECEIPT_WRITTEN: " + str(args.receipt_file))
    print("CANARY_VISUAL_IDENTITY_REVIEW_PENDING")

if __name__ == "__main__":
    main()
