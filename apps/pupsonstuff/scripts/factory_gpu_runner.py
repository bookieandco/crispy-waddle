#!/usr/bin/env python3
"""PUPSON-3D.FACTORY.GENERATE.02-.03: operator-local, strictly OFFLINE GPU runner.

Default is planning/probing: no network, GPU job, model install or paid call.
--execute supports two independently checked local inference code paths:
* Tencent Hunyuan3D-2 (shape + texture) from its official minimal demo
* AiuniAI Unique3D (multiview reconstruction) from app/gradio_3dgen.py
Stable DreamFusion remains a *reviewed source*, not a reliable SKU generator;
we explicitly do not pretend its research training command is a factory API.

Execute only with a separate approval JSON tied to this exact manifest SHA.
Requires checked-out, dependency-installed upstream and predownloaded licensed
checkpoints on an operator-owned NVIDIA GPU. Network is forced offline.
"""
import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
import shutil
import subprocess
import sys

from factory_source_pack import verify_pack, source_path, sha256_file

ENABLED = {"tencent-hunyuan3d-2", "aiuniai-unique3d"}
SAFE_ENV = ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "DIFFUSERS_OFFLINE",
            "HF_DATASETS_OFFLINE", "GRADIO_ANALYTICS_ENABLED")


def local_gpu_mb():
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, check=True, timeout=5,
        )
        return max(int(line.strip()) for line in result.stdout.splitlines() if line.strip())
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0


def offline_env():
    env = dict(os.environ)
    for key in SAFE_ENV:
        env[key] = "0" if key == "GRADIO_ANALYTICS_ENABLED" else "1"
    env["NO_PROXY"] = "*"
    env["no_proxy"] = "*"
    # No cloud access is required. This is a guard against accidental Hub
    # downloads, not an OS-level firewall. Operators must also block egress.
    return env


def preflight(pack, manifest, repo_dir, weights, output, approval=None):
    root = Path(pack).resolve(strict=True)
    reference = verify_pack(root, manifest, for_execution=True)
    problems = list(reference["blockers"])
    generator = manifest.get("generator")
    if generator not in ENABLED:
        problems.append("GENERATOR_NOT_WIRED_FOR_REAL_INFERENCE")
    repo_dir = Path(repo_dir).resolve()
    weights = Path(weights).resolve()
    if not repo_dir.is_dir() or not weights.is_dir() or repo_dir == weights:
        problems.append("LOCAL_REPO_OR_WEIGHTS_NOT_INSTALLED")
    if generator == "tencent-hunyuan3d-2" and not (repo_dir / "hy3dgen").is_dir():
        problems.append("HUNYUAN_LOCAL_PACKAGE_MISSING")
    if generator == "aiuniai-unique3d" and not (repo_dir / "app/gradio_3dgen.py").is_file():
        problems.append("UNIQUE3D_INFERENCE_MODULE_MISSING")
    if generator == "aiuniai-unique3d" and not (repo_dir / "ckpt").is_dir():
        problems.append("UNIQUE3D_CHECKPOINTS_MISSING")
    if weights.is_dir() and not any(p.is_file() for p in weights.rglob("*")):
        problems.append("LOCAL_CHECKPOINT_FILES_MISSING")
    gpu = local_gpu_mb()
    # Hunyuan documented 16 GiB total for shape+texture. The 12 GiB
    # Unique3D threshold is our CONSERVATIVE PRECHECK, NOT a vendor guarantee.
    required = 16384 if generator == "tencent-hunyuan3d-2" else 12288
    if gpu < required:
        problems.append("NVIDIA_VRAM_INSUFFICIENT_OR_UNAVAILABLE")
    dest = Path(output).expanduser().resolve()
    if dest.suffix.lower() != ".glb" or "quarantine" not in dest.parts:
        problems.append("OUTPUT_MUST_BE_PRIVATE_QUARANTINE_GLB")
    if dest.exists():
        problems.append("OUTPUT_ALREADY_EXISTS_REFUSE_OVERWRITE")
    if "/public/" in str(dest) or "/assets/approved/" in str(dest):
        problems.append("ACTIVE_STOREFRONT_WRITE_FORBIDDEN")
    if approval is None:
        problems.append("EXACT_MANIFEST_EXECUTION_APPROVAL_REQUIRED")
    return {"ready": len(problems) == 0, "blockers": sorted(set(problems)),
            "gpuTotalMiB": gpu, "gpuPrecheckMinimumMiB": required,
            "source": generator, "storefrontApproved": False,
            "networkBlockedByOS": False,
            "notes": "Use an OS firewall to enforce egress blocking; offline library flags are not a sandbox."}


def verify_approval(path, manifest_file, generator):
    """Receipt is operator attestation, not an authenticated signature."""
    if path is None:
        raise ValueError("APPROVAL_FILE_MISSING")
    approval = json.loads(Path(path).read_text("utf8"))
    expected = sha256_file(Path(manifest_file))
    if approval.get("enabled") is not True or approval.get("manifestSha256") != expected:
        raise ValueError("EXECUTION_APPROVAL_MISMATCH")
    if approval.get("generator") != generator or not isinstance(approval.get("approvedBy"), str) or len(approval["approvedBy"].strip()) < 4:
        raise ValueError("MODEL_OR_OPERATOR_APPROVAL_MISSING")
    if approval.get("termsAndCheckpointsReviewed") is not True or approval.get("noPaidGpuOrApi") is not True:
        raise ValueError("COMPUTE_AND_LICENSE_APPROVAL_MISSING")
    return approval


def run_hunyuan(front, weights, dest, repo_dir):
    # Imports are intentional ONLY after gated --execute.
    from PIL import Image
    sys.path.insert(0, str(repo_dir))
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from hy3dgen.texgen import Hunyuan3DPaintPipeline
    image = Image.open(front).convert("RGBA")
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(str(weights))
    painter = Hunyuan3DPaintPipeline.from_pretrained(str(weights))
    mesh = painter(shape(image=image)[0], image=image)
    mesh.export(str(dest))


def run_unique(front, repo_dir, dest):
    sys.path.insert(0, str(repo_dir))
    old = Path.cwd()
    try:
        os.chdir(repo_dir)   # Unique3D resolves ckpt/ relative to repo root.
        import torch
        from app.all_models import model_zoo
        from app.gradio_3dgen import generate3dv2
        if not torch.cuda.is_available():
            raise RuntimeError("UNIQUE3D_CUDA_UNAVAILABLE")
        model_zoo.init_models()
        generated_path, _ = generate3dv2(
            str(front), True, 6174, render_video=False, do_refine=True
        )
        # Upstream saves under /tmp/gradio; COPY only to private quarantine.
        if not isinstance(generated_path, str) or Path(generated_path).suffix.lower() != ".glb":
            raise ValueError("UNIQUE3D_RETURNED_NO_GLB")
        shutil.copyfile(generated_path, dest)
    finally:
        os.chdir(old)


def validate_glb_header(path):
    """Minimal container sanity only; deeper audit stays in candidate-intake."""
    import struct
    p = Path(path)
    if not p.is_file() or not 256 <= p.stat().st_size <= 10 * 1024 * 1024:
        raise ValueError("GENERATED_GLB_MISSING_OR_OVER_MOBILE_BUDGET")
    with p.open("rb") as f:
        first = f.read(12)
    if len(first) != 12:
        raise ValueError("GENERATED_GLB_INVALID_HEADER")
    magic, version, length = struct.unpack("<4sII", first)
    if (magic, version, length) != (b"glTF", 2, p.stat().st_size):
        raise ValueError("GENERATED_GLB_INVALID_HEADER")


def cli(args=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--pack", required=True)
    parser.add_argument("--repo", required=True, help="existing local official source checkout")
    parser.add_argument("--weights", required=True, help="existing predownloaded licensed checkpoints")
    parser.add_argument("--output", required=True, help="new path below private/quarantine")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--approval-file", default=None)
    opts = parser.parse_args(args)
    root = Path(opts.pack).resolve(strict=True)
    mfile = source_path(root, "manifest.json")
    manifest = json.loads(mfile.read_text("utf8"))
    if opts.execute:
        approval = verify_approval(opts.approval_file, mfile, manifest.get("generator"))
    else:
        approval = None
    result = preflight(root, manifest, opts.repo, opts.weights, opts.output, approval)
    print(json.dumps({"mode": "execute" if opts.execute else "probe-only", **result}, indent=2))
    if not opts.execute:
        return 0  # a blocked preflight is a useful non-mutating diagnostic
    if not result["ready"]:
        raise SystemExit("GPU / licenses / reference pack not ready; refusing generation.")
    output = Path(opts.output).resolve()
    front = source_path(root, manifest["references"]["front"]["file"])
    os.environ.update(offline_env())
    # Explicit non-auto network posture. Operator also required to firewall.
    if os.environ.get("PUPSON_FACTORY_OS_NETWORK_BLOCKED") != "true":
        raise SystemExit("OS egress deny not attested; refuse potentially networked model run.")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Generate to a disposable non-public candidate first. A crash must never
    # leave a half-written .glb that looks like a complete review candidate.
    with tempfile.TemporaryDirectory(prefix="pupson-unapproved-", dir=str(output.parent)) as stage:
        provisional = Path(stage) / "raw.glb"
        if manifest["generator"] == "tencent-hunyuan3d-2":
            run_hunyuan(front, Path(opts.weights).resolve(), provisional, Path(opts.repo).resolve())
        elif manifest["generator"] == "aiuniai-unique3d":
            run_unique(front, Path(opts.repo).resolve(), provisional)
        validate_glb_header(provisional)
        # Exclusive creation refuses a pre-existing output (including a race).
        with output.open("xb") as target, provisional.open("rb") as origin:
            shutil.copyfileobj(origin, target)
    validate_glb_header(output)
    receipt = {"generator": manifest["generator"], "candidateId": manifest["candidateId"],
               "inputManifestSha256": sha256_file(mfile),
               "outputSha256": sha256_file(output),
               "approvalReceiptSha256": sha256_file(Path(opts.approval_file)),
               "status": "QUARANTINE_UNVALIDATED", "storefrontApproved": False,
               "printifyOrderEnabled": False,
               "requiredNext": ["Blender physical dimensions/normalization",
                                "GLB technical audit and screenshot comparison",
                                "Printify print-zone and physical-sample review"]}
    output.with_suffix(".source.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8")
    print(json.dumps(receipt, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(cli())
