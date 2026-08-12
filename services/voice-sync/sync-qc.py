from dataclasses import dataclass

@dataclass
class SyncQC:
    overall: float
    max_offset_ms: float
    mean_offset_ms: float
    overlap_errors: int
    missing_speaker_segments: int
    status: str


def evaluate_sync(voice_segments: list[dict], mouth_frames: list[dict], tolerance_ms: float = 80.0) -> SyncQC:
    if not voice_segments:
        return SyncQC(0, 0, 0, 0, 0, 'blocked')
    offsets = []
    missing = 0
    for segment in voice_segments:
        matching = [f for f in mouth_frames if f.get('character_id') == segment.get('character_id')]
        if not matching:
            missing += 1
            continue
        first = min(int(f['timestamp_ms']) for f in matching)
        offsets.append(abs(first - int(segment['start_ms'])))
    mean = sum(offsets) / len(offsets) if offsets else float('inf')
    max_offset = max(offsets) if offsets else float('inf')
    score = max(0.0, 100.0 - (mean * 0.5 if offsets else 100.0) - missing * 20.0)
    status = 'pass' if max_offset <= tolerance_ms and missing == 0 else 'review'
    return SyncQC(score, max_offset, mean, 0, missing, status)
