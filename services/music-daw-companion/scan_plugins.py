"""JHADINA DAW laptop-only installed-plugin DISCOVERY; never executes binaries.

VST3/AU modules are not Python imports. Their native binary execution requires
a separately audited plugin host with crash isolation, latency and licensing QC.
"""
from __future__ import annotations
import hashlib
import hmac
import os
from pathlib import Path
import platform
from typing import Iterable


def default_roots(system: str | None = None, home: Path | None = None) -> list[Path]:
    system = (system or platform.system()).lower()
    home = home or Path.home()
    if system == "darwin":
        return [
            Path("/Library/Audio/Plug-Ins/VST3"),
            home / "Library/Audio/Plug-Ins/VST3",
            Path("/Library/Audio/Plug-Ins/Components"),
            home / "Library/Audio/Plug-Ins/Components",
        ]
    if system == "windows":
        return [
            Path(os.environ.get("COMMONPROGRAMFILES", "C:/Program Files/Common Files")) / "VST3",
        ]
    return [Path("/usr/lib/vst3"), home / ".vst3"]


def discover_installed_plugins(secret: str, roots: Iterable[Path] | None = None,
                               max_entries: int = 500) -> list[dict[str, str]]:
    if len(secret) < 24:
        raise ValueError("MUSIC_DAW_COMPANION_STRONG_TOKEN_REQUIRED")
    if not 1 <= max_entries <= 500:
        raise ValueError("MUSIC_DAW_COMPANION_SCAN_LIMIT_INVALID")
    result = []
    seen = set()
    for root in list(roots if roots is not None else default_roots())[:8]:
        # Never follow a symlink to a plugin root. Never inspect arbitrary paths
        # supplied in a browser request.
        if root.is_symlink() or not root.is_dir():
            continue
        try:
            entries = sorted(root.iterdir(), key=lambda p: p.name.casefold())
        except OSError:
            continue
        for entry in entries:
            if len(result) >= max_entries:
                return result
            if entry.is_symlink() or not entry.is_dir():
                continue
            ext = entry.suffix.lower()
            if ext not in (".vst3", ".component"):
                continue
            fmt = "vst3" if ext == ".vst3" else "au"
            if fmt == "au" and platform.system().lower() != "darwin":
                continue
            identifier = hmac.new(secret.encode(), str(entry.resolve()).encode(),
                                  hashlib.sha256).hexdigest()[:40]
            if identifier in seen:
                continue
            seen.add(identifier)
            result.append({
                "pluginId": "native-installed:" + identifier,
                "name": entry.stem[:120], "format": fmt,
                "status": "discovered-not-executable",
            })
    return result
