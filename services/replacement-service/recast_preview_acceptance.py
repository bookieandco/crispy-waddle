"""Offline Recast before/after media acceptance. No rendering or remote API calls.

An operator must supply two already-existing, hash-pinned local clips inside
an admitted directory. This verifies media metadata only, not AI identity,
lip-sync accuracy, likeness consent, or final publication approval.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable
import hashlib
import importlib.util

_probe_path=Path(__file__).with_name("recast_probe.py")
_spec=importlib.util.spec_from_file_location("_director_recast_probe",_probe_path)
if _spec is None or _spec.loader is None:
    raise RuntimeError("DIRECTOR_RECAST_PROBE_UNAVAILABLE")
_probe=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_probe)

def inspect_recast_local_pair(
    *, admitted_media_root: str,
    source_path: str, preview_path: str,
    source_sha256: str, preview_sha256: str,
    project_id: str, source_asset_id: str, preview_asset_id: str,
    runner: Callable[..., Any],
) -> dict[str, Any]:
    if not preview_asset_id or preview_asset_id == source_asset_id:
        raise ValueError("DIRECTOR_RECAST_PREVIEW_IDENTITY_MUST_BE_DISTINCT")
    if Path(source_path).resolve() == Path(preview_path).resolve():
        raise ValueError("DIRECTOR_RECAST_PREVIEW_SOURCE_REUSE_FORBIDDEN")
    source=_probe.probe_local_recast_source(
        admitted_media_root=admitted_media_root,
        local_source_path=source_path, project_id=project_id,
        source_asset_id=source_asset_id, expected_sha256=source_sha256,
        runner=runner,
    )
    preview=_probe.probe_local_recast_source(
        admitted_media_root=admitted_media_root,
        local_source_path=preview_path, project_id=project_id,
        source_asset_id=preview_asset_id, expected_sha256=preview_sha256,
        runner=runner,
    )
    blockers=[]
    if abs(source["durationSeconds"]-preview["durationSeconds"]) > 0.25:
        blockers.append("DIRECTOR_RECAST_LOCAL_CLIP_DURATION_MISMATCH")
    if (source["frameWidth"],source["frameHeight"]) != (preview["frameWidth"],preview["frameHeight"]):
        blockers.append("DIRECTOR_RECAST_LOCAL_FRAME_DIMENSIONS_MISMATCH")
    if not preview["hasAudioStream"]:
        blockers.append("DIRECTOR_RECAST_LOCAL_PREVIEW_AUDIO_MISSING")
    if source["sourceVideoSha256"] == preview["sourceVideoSha256"]:
        blockers.append("DIRECTOR_RECAST_LOCAL_PREVIEW_NOT_DISTINCT")
    return {
        "schemaVersion":"director.recast.local-media-evidence.v1",
        "projectId":project_id,
        "sourceAssetId":source_asset_id,
        "previewAssetId":preview_asset_id,
        "sourceSha256":source["sourceVideoSha256"],
        "previewSha256":preview["sourceVideoSha256"],
        "metadataConformant":not blockers,
        "blockers":blockers,
        "visualIdentityMeasured":False,
        "lipSyncMeasured":False,
        "independentQCAccepted":False,
        "ownerApproved":False,
        "renderExecuted":False,
        "workerPermit":None,
        "publicationAuthority":"NONE",
    }
