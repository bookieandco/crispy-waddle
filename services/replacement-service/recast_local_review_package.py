"""Offline, hash-bound preview evidence package for the *first real* Recast test.

Works with an already-existing source+output pair in an admitted local root.
No worker dispatch, media upload, network, GPU inference, paid job, or approval.
"""
from __future__ import annotations
import hashlib
import json
import importlib.util
from pathlib import Path
import subprocess
from typing import Any,Callable

def _load(module_name:str)->Any:
    spec=importlib.util.spec_from_file_location(module_name,Path(__file__).with_name(module_name+".py"))
    if spec is None or spec.loader is None:
        raise RuntimeError("DIRECTOR_RECAST_LOCAL_QC_DEPENDENCY_MISSING")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

_media=_load("recast_preview_acceptance")
_audio=_load("recast_audio_integrity")

def build_recast_local_review_package(
    *,admitted_media_root:str,source_path:str,preview_path:str,
    source_sha256:str,preview_sha256:str,
    project_id:str,source_asset_id:str,preview_asset_id:str,
    runner:Callable[...,Any]=subprocess.run,
)->dict[str,Any]:
    media=_media.inspect_recast_local_pair(
        admitted_media_root=admitted_media_root,
        source_path=source_path,preview_path=preview_path,
        source_sha256=source_sha256,preview_sha256=preview_sha256,
        project_id=project_id,source_asset_id=source_asset_id,
        preview_asset_id=preview_asset_id,runner=runner,
    )
    pcm=_audio.compare_decoded_original_audio(
        admitted_media_root=admitted_media_root,
        original_video_path=source_path,preview_video_path=preview_path,
        original_sha256=source_sha256,preview_sha256=preview_sha256,
        runner=runner,
    )
    blockers=[*media["blockers"],*pcm["blockers"]]
    body={
        "schemaVersion":"director.recast.local-preview-package.v1",
        "projectId":project_id,
        "sourceAssetId":source_asset_id,"previewAssetId":preview_asset_id,
        "sourceSha256":media["sourceSha256"],
        "previewSha256":media["previewSha256"],
        "sourcePcmSha256":pcm["sourcePcmSha256"],
        "previewPcmSha256":pcm["previewPcmSha256"],
        "mediaMetadataValid":media["metadataConformant"],
        "sourceAudioUnchanged":pcm["decodedAudioExactlyPreserved"],
        "blockers":blockers,
        "readyForManualReview":not blockers,
        "identityReviewed":False,
        "lipSyncVerified":False,
        "likenessAndRightsConfirmed":False,
        "independentQCApproved":False,
        "ownerApproved":False,
        "runAuthorized":False,
        "renderWorkerInvoked":False,
        "costAuthority":"NONE",
        "publicationAuthority":"NONE",
    }
    body["manifestSha256"]=hashlib.sha256(
        json.dumps(body,sort_keys=True,separators=(",",":"),allow_nan=False).encode("utf-8")
    ).hexdigest()
    return body
