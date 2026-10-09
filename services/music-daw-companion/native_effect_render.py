"""One-plugin, SOURCE-BOUND optional VST3/AU offline WAV renderer.

Run on the laptop after explicit approval; GPLv3 DawDreamer stays an optional
user-installed dependency. No arbitrary user-controlled plugin paths, no
background rendering, no silent subscription, no public audio publication.
This is a subprocess worker entrypoint, not an exposed cloud endpoint.
"""
from __future__ import annotations
from hashlib import sha256
import importlib
import json
import math
import os
from pathlib import Path
from typing import Any

from scan_plugins import resolve_installed_plugin

MAX_WAV_BYTES = 100 * 1024 * 1024
MAX_SECONDS = 90


def render_native_effect(
    source_wav: Path, source_sha256: str, plugin_id: str, output_wav: Path,
    owner_approved: bool, secret: str, roots: list[Path] | None = None,
) -> dict[str, Any]:
    if os.environ.get("MUSIC_DAW_NATIVE_RENDER_ENABLED") != "YES":
        raise RuntimeError("MUSIC_DAW_NATIVE_DSP_NOT_COMMISSIONED")
    if not owner_approved:
        raise PermissionError("MUSIC_DAW_OWNER_APPROVAL_REQUIRED")
    if len(secret) < 24:
        raise PermissionError("MUSIC_DAW_STRONG_TOKEN_REQUIRED")
    if (not source_wav.is_file() or source_wav.is_symlink() or
            source_wav.suffix.lower() != ".wav" or
            not 44 <= source_wav.stat().st_size <= MAX_WAV_BYTES or
            len(source_sha256) != 64 or sha256(source_wav.read_bytes()).hexdigest() != source_sha256.lower()):
        raise ValueError("MUSIC_DAW_SOURCE_WAV_HASH_INVALID")
    if output_wav.resolve() == source_wav.resolve() or output_wav.exists():
        raise ValueError("MUSIC_DAW_IMMUTABLE_SOURCE_OR_EXISTING_OUTPUT")
    plugin = resolve_installed_plugin(plugin_id, secret, roots)
    import numpy as np
    import soundfile as sf
    with sf.SoundFile(source_wav) as reader:
        rate, channels, frames = reader.samplerate, reader.channels, len(reader)
        if rate < 8000 or rate > 192000 or channels != 2 or frames <= 0 or frames/rate > MAX_SECONDS:
            raise ValueError("MUSIC_DAW_NATIVE_INPUT_TIMEBASE_UNSUPPORTED")
        audio = reader.read(dtype="float32", always_2d=True)
    if not np.all(np.isfinite(audio)):
        raise ValueError("MUSIC_DAW_NATIVE_SOURCE_NONFINITE")
    # Native plugin loading happens only after explicit approval. Plugins can
    # execute arbitrary code as this user's OS account; operator must trust
    # each installed plugin. A subprocess timeout/crash supervisor is required.
    daw = importlib.import_module("dawdreamer")
    engine = daw.RenderEngine(rate, 512)
    playback = engine.make_playback_processor("immutable_source", np.ascontiguousarray(audio.T))
    effect = engine.make_plugin_processor("authorized_fx", str(plugin))
    if effect.get_num_input_channels() < 2 or effect.get_num_output_channels() < 2:
        raise ValueError("MUSIC_DAW_NATIVE_EFFECT_INPUT_OUTPUT_REQUIRED")
    engine.load_graph([(playback, []), (effect, [playback.get_name()])])
    engine.render(frames/rate)
    rendered = np.asarray(engine.get_audio(), dtype=np.float64)
    if rendered.shape != (2, frames) or not np.all(np.isfinite(rendered)):
        raise ValueError("MUSIC_DAW_NATIVE_RENDER_LENGTH_OR_NONFINITE_INVALID")
    # Output is NEWLY PROCESSED material. Never claim repaired original audio.
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    sf.write(output_wav, np.ascontiguousarray(rendered.T), rate, subtype="FLOAT")
    output_hash = sha256(output_wav.read_bytes()).hexdigest()
    stats = {
        "operationClass": "plugin-processed",
        "originalRecovered": False,
        "ownerApproved": True,
        "sourceSha256": source_sha256.lower(),
        "outputSha256": output_hash,
        "pluginId": plugin_id,
        "sampleRate": rate, "channels": channels, "sampleCount": frames,
        "maxAbsolutePeak": float(np.max(np.abs(rendered))),
        "sourceImmutable": True, "needsHumanAudition": True,
        "nativePluginExecuted": True, "effectIdentityAttested": False,
        "restorationCertified": False,
    }
    stats["receiptSha256"] = sha256(json.dumps(stats, sort_keys=True).encode()).hexdigest()
    return stats
