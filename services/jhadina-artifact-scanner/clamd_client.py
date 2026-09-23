"""Minimal fail-closed ClamD INSTREAM client for Jhadina Artifact Core."""
from __future__ import annotations

import hashlib
import os
import socket
import struct
from dataclasses import dataclass
from typing import BinaryIO


class ClamdError(RuntimeError):
    pass


@dataclass(frozen=True)
class ClamdScan:
    sha256: str
    size_bytes: int
    infected: bool
    signature: str | None
    raw_reply: str


class ClamdClient:
    def __init__(
        self,
        *,
        unix_socket: str | None = None,
        host: str | None = None,
        port: int = 3310,
        timeout_seconds: float = 45.0,
        chunk_bytes: int = 1024 * 1024,
        max_bytes: int = 250 * 1024 * 1024,
    ) -> None:
        self.unix_socket = unix_socket
        self.host = host
        self.port = port
        self.timeout_seconds = timeout_seconds
        self.chunk_bytes = chunk_bytes
        self.max_bytes = max_bytes
        if not self.unix_socket and not self.host:
            raise ClamdError("CLAMD_ENDPOINT_NOT_CONFIGURED")

    @classmethod
    def from_env(cls) -> "ClamdClient":
        host = os.getenv("CLAMD_HOST") or None
        unix_socket = os.getenv("CLAMD_UNIX_SOCKET") or (None if host else "/tmp/clamd.sock")
        return cls(
            unix_socket=unix_socket,
            host=host,
            port=int(os.getenv("CLAMD_PORT", "3310")),
            timeout_seconds=float(os.getenv("CLAMD_TIMEOUT_SECONDS", "45")),
            max_bytes=int(os.getenv("JHADINA_ARTIFACT_SCAN_MAX_BYTES", str(250 * 1024 * 1024))),
        )

    def _connect(self) -> socket.socket:
        if self.unix_socket:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            address: str | tuple[str, int] = self.unix_socket
        else:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            address = (self.host or "", self.port)
        sock.settimeout(self.timeout_seconds)
        sock.connect(address)
        return sock

    @staticmethod
    def _read_record(sock: socket.socket) -> str:
        parts: list[bytes] = []
        while True:
            data = sock.recv(4096)
            if not data:
                break
            if b"\0" in data:
                before, _sep, _after = data.partition(b"\0")
                parts.append(before)
                break
            parts.append(data)
        if not parts:
            raise ClamdError("CLAMD_EMPTY_REPLY")
        return b"".join(parts).decode("utf-8", "replace").strip()

    def ping(self) -> str:
        with self._connect() as sock:
            sock.sendall(b"zPING\0")
            reply = self._read_record(sock)
        if reply != "PONG":
            raise ClamdError(f"CLAMD_UNEXPECTED_PING:{reply[:120]}")
        return reply

    def scan_stream(self, source: BinaryIO) -> ClamdScan:
        digest = hashlib.sha256()
        size_bytes = 0
        with self._connect() as sock:
            sock.sendall(b"zINSTREAM\0")
            while True:
                chunk = source.read(self.chunk_bytes)
                if not chunk:
                    break
                if not isinstance(chunk, (bytes, bytearray)):
                    raise ClamdError("CLAMD_SOURCE_NOT_BINARY")
                size_bytes += len(chunk)
                if size_bytes > self.max_bytes:
                    raise ClamdError("CLAMD_SCAN_SIZE_LIMIT")
                digest.update(chunk)
                sock.sendall(struct.pack(">I", len(chunk)))
                sock.sendall(chunk)
            sock.sendall(struct.pack(">I", 0))
            reply = self._read_record(sock)
        infected, signature = parse_scan_reply(reply)
        return ClamdScan(
            sha256=digest.hexdigest(),
            size_bytes=size_bytes,
            infected=infected,
            signature=signature,
            raw_reply=reply,
        )


def parse_scan_reply(reply: str) -> tuple[bool, str | None]:
    normalized = reply.strip()
    if normalized.endswith(": OK"):
        return False, None
    if normalized.endswith(" FOUND"):
        marker = normalized.rfind(": ")
        signature = normalized[marker + 2 : -len(" FOUND")] if marker >= 0 else normalized[:-len(" FOUND")]
        signature = signature.strip()
        if not signature:
            raise ClamdError("CLAMD_EMPTY_SIGNATURE")
        return True, signature
    raise ClamdError(f"CLAMD_SCAN_ERROR:{normalized[:160]}")
