from dataclasses import dataclass
from typing import Optional

@dataclass
class SyncMetrics:
    sync_offset_ms: Optional[float]
    confidence: Optional[float]
    duration_ms: Optional[float]
    frames_checked: int
    dropped_frames: int


def score_sync(metrics: SyncMetrics) -> dict:
    warnings = []
    score = 100.0
    if metrics.sync_offset_ms is None or metrics.confidence is None:
        return {"overall": None, "warnings": ["Independent lip-sync measurement is unavailable."], "metrics": metrics.__dict__}
    offset = abs(metrics.sync_offset_ms)
    if offset > 120:
        warnings.append(f"Average sync offset is {offset:.0f} ms.")
        score -= min(35, (offset - 120) / 4)
    elif offset > 60:
        warnings.append(f"Average sync offset is {offset:.0f} ms; review recommended.")
        score -= (offset - 60) / 4
    if metrics.confidence < 0.85:
        warnings.append(f"Lip tracking confidence is {metrics.confidence:.0%}.")
        score -= (0.85 - metrics.confidence) * 100
    if metrics.dropped_frames:
        warnings.append(f"{metrics.dropped_frames} dropped frames detected.")
        score -= min(20, metrics.dropped_frames * 2)
    return {"overall": round(max(0, min(100, score)), 1), "warnings": warnings, "metrics": metrics.__dict__}
