"""Strict HTTPS staging for private Music restoration source URLs."""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import urllib.parse
import urllib.request

MAX_SOURCE_BYTES=500*1024*1024

def is_sha256(value:str)->bool:
    return len(value)==64 and all(ch in "0123456789abcdefABCDEF" for ch in value)

def stage_verified_source(uri:str,expected_sha256:str,destination:Path)->int:
    if not is_sha256(expected_sha256):
        raise ValueError("MUSIC_RESTORATION_SOURCE_SHA256_INVALID")
    parsed=urllib.parse.urlparse(uri)
    if parsed.scheme!="https" or parsed.username or parsed.password or not parsed.hostname:
        raise ValueError("MUSIC_RESTORATION_SOURCE_URI_NOT_ADMITTED")
    request=urllib.request.Request(uri,headers={"User-Agent":"jhadina-music-restoration/1"})
    digest=sha256()
    total=0
    with urllib.request.urlopen(request,timeout=120) as response, destination.open("wb") as output:
        while True:
            chunk=response.read(1024*1024)
            if not chunk:
                break
            total+=len(chunk)
            if total>MAX_SOURCE_BYTES:
                raise ValueError("MUSIC_RESTORATION_SOURCE_TOO_LARGE")
            digest.update(chunk)
            output.write(chunk)
    if total<=0:
        destination.unlink(missing_ok=True)
        raise ValueError("MUSIC_RESTORATION_SOURCE_EMPTY")
    if digest.hexdigest().lower()!=expected_sha256.lower():
        destination.unlink(missing_ok=True)
        raise ValueError("MUSIC_RESTORATION_SOURCE_HASH_MISMATCH")
    return total
