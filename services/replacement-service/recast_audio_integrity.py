"""Strict *offline* decoded-audio comparison for an existing Recast preview.

No audio replacement, video generation, cloud processing, or publication.
Requires independently admitted local source+preview paths and expected
file SHA-256. A passing hash measures audio sample equality only, NOT
character identity, voice consent, lip motion or QC approval.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import subprocess
from typing import Any, Callable

MAX_FILE_BYTES=300*1024*1024
MAX_PCM_BYTES=1_100_000  # 30s x 16000 Hz x mono x signed 16-bit + header margin

def _admitted_file(root:str,path:str,expected_sha256:str)->Path:
    resolved_root=Path(root).resolve(strict=True)
    source=Path(path).resolve(strict=True)
    if not source.is_relative_to(resolved_root) or not source.is_file():
        raise ValueError("DIRECTOR_RECAST_AUDIO_PATH_NOT_ADMITTED")
    if not 0<source.stat().st_size<=MAX_FILE_BYTES:
        raise ValueError("DIRECTOR_RECAST_AUDIO_SOURCE_SIZE_INVALID")
    if not isinstance(expected_sha256,str) or len(expected_sha256)!=64 or any(
        ch not in "0123456789abcdefABCDEF" for ch in expected_sha256
    ):
        raise ValueError("DIRECTOR_RECAST_AUDIO_HASH_REQUIRED")
    sha=hashlib.sha256()
    with source.open("rb") as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b""):
            sha.update(chunk)
    if sha.hexdigest()!=expected_sha256.lower():
        raise ValueError("DIRECTOR_RECAST_AUDIO_SOURCE_HASH_MISMATCH")
    return source

def compare_decoded_original_audio(
    *, admitted_media_root:str,
    original_video_path:str,
    preview_video_path:str,
    original_sha256:str,
    preview_sha256:str,
    runner:Callable[...,Any]=subprocess.run,
)->dict[str,Any]:
    original=_admitted_file(admitted_media_root,original_video_path,original_sha256)
    preview=_admitted_file(admitted_media_root,preview_video_path,preview_sha256)
    if original==preview or original_sha256.lower()==preview_sha256.lower():
        raise ValueError("DIRECTOR_RECAST_PREVIEW_MUST_BE_DISTINCT")
    digests=[]
    for path in (original,preview):
        args=[
            "ffmpeg","-hide_banner","-nostdin","-v","error",
            "-i",str(path),"-map","0:a:0","-vn",
            "-ar","16000","-ac","1","-t","30",
            "-f","s16le","pipe:1",
        ]
        run=runner(args,check=False,capture_output=True,timeout=30)
        if run.returncode!=0 or not isinstance(run.stdout,bytes) or not run.stdout:
            raise ValueError("DIRECTOR_RECAST_DECODED_AUDIO_UNAVAILABLE")
        if len(run.stdout)>MAX_PCM_BYTES:
            raise ValueError("DIRECTOR_RECAST_DECODED_AUDIO_TOO_LARGE")
        digests.append(hashlib.sha256(run.stdout).hexdigest())
    equal=digests[0]==digests[1]
    return {
        "schemaVersion":"director.recast.audio-match.v1",
        "sourcePcmSha256":digests[0],
        "previewPcmSha256":digests[1],
        "decodedAudioExactlyPreserved":equal,
        "blockers":[] if equal else ["DIRECTOR_RECAST_ORIGINAL_AUDIO_ALTERED"],
        "lipSyncVerified":False,
        "independentQualityApproved":False,
        "publicationAuthority":"NONE",
    }
