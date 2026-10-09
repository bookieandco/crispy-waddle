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
            if entry.is_symlink():
                continue
            ext = entry.suffix.lower()
            if ext not in (".vst3", ".component"):
                continue
            # Windows also ships single-file VST3 DLL modules; macOS usually
            # ships bundle directories. We only list, never import/load.
            if not (entry.is_dir() or (ext == ".vst3" and entry.is_file())):
                continue
            if entry.is_file():
                # Cheap PE/ELF/Mach-O header gate; no binary loading/execution.
                # A forged magic byte does NOT establish a valid signed VST.
                try:
                    with entry.open("rb") as stream:
                        header = stream.read(4)
                except OSError:
                    continue
                if not (header[:2] == b"MZ" or header == b"\x7fELF" or
                        header in (bytes.fromhex("feedface"), bytes.fromhex("feedfacf"),
                                   bytes.fromhex("cefaedfe"), bytes.fromhex("cffaedfe"))):
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


def resolve_installed_plugin(plugin_id: str, secret: str,
                             roots: Iterable[Path] | None = None) -> Path:
    """Privately resolve ONLY an ID from this laptop's scanner inventory.
    No caller-supplied file paths and no recursive plugin file search.
    """
    if not isinstance(plugin_id, str) or not plugin_id.startswith("native-installed:"):
        raise ValueError("MUSIC_DAW_PLUGIN_NOT_IN_LOCAL_INVENTORY")
    for root in list(roots if roots is not None else default_roots())[:8]:
        if root.is_symlink() or not root.is_dir():
            continue
        for entry in sorted(root.iterdir(), key=lambda e: e.name.casefold())[:1000]:
            if entry.is_symlink() or entry.suffix.lower() not in (".vst3", ".component"):
                continue
            if not entry.is_dir() and not entry.is_file():
                continue
            if entry.is_file():
                try:
                    with entry.open("rb") as file:
                        magic = file.read(4)
                except OSError:
                    continue
                if not (magic[:2] == b"MZ" or magic == b"\x7fELF" or
                        magic in (bytes.fromhex("feedface"), bytes.fromhex("feedfacf"),
                                  bytes.fromhex("cefaedfe"), bytes.fromhex("cffaedfe"))):
                    continue
            fmt = "vst3" if entry.suffix.lower() == ".vst3" else "au"
            if fmt == "au" and platform.system().lower() != "darwin":
                continue
            digest = hmac.new(secret.encode(), str(entry.resolve()).encode(),
                              hashlib.sha256).hexdigest()[:40]
            if hmac.compare_digest("native-installed:" + digest, plugin_id):
                return entry
    raise ValueError("MUSIC_DAW_PLUGIN_NOT_IN_LOCAL_INVENTORY")
