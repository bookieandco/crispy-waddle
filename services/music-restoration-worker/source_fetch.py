"""Strict, byte-verified HTTPS staging for private restoration sources.

No urllib automatic redirects: DNS addresses are checked and pinned before TLS,
and each Location is admitted before the next network request.
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import http.client
import ipaddress
import os
import socket
import ssl
import tempfile
import urllib.parse

MAX_SOURCE_BYTES = 500 * 1024 * 1024
MAX_REDIRECTS = 3

def is_sha256(value: str) -> bool:
    return len(value) == 64 and all(ch in "0123456789abcdefABCDEF" for ch in value)

def _admitted_url(uri: str, admitted_host_suffixes: tuple[str, ...]) -> bool:
    try:
        parsed = urllib.parse.urlsplit(uri)
        hostname = (parsed.hostname or "").rstrip(".").lower()
        port = parsed.port
        ipaddress.ip_address(hostname)  # IP literals are never admitted
        return False
    except ValueError:
        pass
    if parsed.scheme != "https" or parsed.username or parsed.password or not hostname:
        return False
    try:
        if parsed.port not in (None, 443):
            return False
    except ValueError:
        return False
    for raw in admitted_host_suffixes:
        suffix = raw.strip().lstrip(".").rstrip(".").lower()
        if suffix and (hostname == suffix or hostname.endswith("." + suffix)):
            return True
    return False

def _request_once(uri: str):
    """Return an HTTPS connection and response with the resolved address pinned."""
    parsed = urllib.parse.urlsplit(uri)
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("MUSIC_RESTORATION_SOURCE_HOST_NOT_ADMITTED")
    addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(
        not ipaddress.ip_address(info[4][0]).is_global for info in addresses
    ):
        raise ValueError("MUSIC_RESTORATION_SOURCE_ADDRESS_NOT_ADMITTED")
    # Fail closed if the selected address fails. Do not re-resolve through
    # HTTPSConnection or an environment proxy after checking DNS.
    family, socktype, proto, _, sockaddr = addresses[0]
    raw = socket.socket(family, socktype, proto)
    raw.settimeout(120)
    connection = http.client.HTTPSConnection(hostname, port=443, timeout=120)
    try:
        raw.connect(sockaddr)
        connection.sock = ssl.create_default_context().wrap_socket(
            raw, server_hostname=hostname,
        )
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query
        connection.request(
            "GET", path,
            headers={"User-Agent": "jhadina-music-restoration/1", "Accept": "audio/*"},
        )
        return connection, connection.getresponse()
    except Exception:
        raw.close()
        connection.close()
        raise

def stage_verified_source(
    uri: str,
    expected_sha256: str,
    destination: Path,
    admitted_host_suffixes: tuple[str, ...] = (".supabase.co",),
) -> int:
    if not is_sha256(expected_sha256):
        raise ValueError("MUSIC_RESTORATION_SOURCE_SHA256_INVALID")
    if not admitted_host_suffixes or not _admitted_url(uri, admitted_host_suffixes):
        raise ValueError("MUSIC_RESTORATION_SOURCE_HOST_NOT_ADMITTED")
    if not destination.parent.is_dir():
        raise ValueError("MUSIC_RESTORATION_SOURCE_DESTINATION_INVALID")

    digest = sha256()
    total = 0
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=".music-source-",
                                     suffix=".part", delete=False) as output:
            temp_path = Path(output.name)
            current = uri
            for redirect_count in range(MAX_REDIRECTS + 1):
                if not _admitted_url(current, admitted_host_suffixes):
                    raise ValueError("MUSIC_RESTORATION_SOURCE_REDIRECT_NOT_ADMITTED")
                connection, response = _request_once(current)
                try:
                    if response.status in (301, 302, 303, 307, 308):
                        location = response.getheader("Location")
                        if not location or redirect_count >= MAX_REDIRECTS:
                            raise ValueError("MUSIC_RESTORATION_SOURCE_REDIRECT_LIMIT")
                        next_uri = urllib.parse.urljoin(current, location)
                        if not _admitted_url(next_uri, admitted_host_suffixes):
                            raise ValueError("MUSIC_RESTORATION_SOURCE_REDIRECT_NOT_ADMITTED")
                        current = next_uri
                        continue
                    if response.status != 200:
                        raise ValueError("MUSIC_RESTORATION_SOURCE_HTTP_STATUS_INVALID")
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > MAX_SOURCE_BYTES:
                            raise ValueError("MUSIC_RESTORATION_SOURCE_TOO_LARGE")
                        digest.update(chunk)
                        output.write(chunk)
                    break
                finally:
                    connection.close()
            else:
                raise ValueError("MUSIC_RESTORATION_SOURCE_REDIRECT_LIMIT")
        if total <= 0:
            raise ValueError("MUSIC_RESTORATION_SOURCE_EMPTY")
        if digest.hexdigest().lower() != expected_sha256.lower():
            raise ValueError("MUSIC_RESTORATION_SOURCE_HASH_MISMATCH")
        os.replace(temp_path, destination)
        temp_path = None
        return total
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
