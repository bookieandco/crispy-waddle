from dataclasses import dataclass

@dataclass
class VoiceSegment:
    character_id: str
    start_ms: int
    end_ms: int
    confidence: float
    source: str


def assign_voice_segments(segments: list[dict], character_map: dict[str, str]) -> list[VoiceSegment]:
    result = []
    for segment in segments:
        speaker = segment.get('speaker')
        character_id = character_map.get(speaker)
        if not character_id:
            continue
        result.append(VoiceSegment(
            character_id=character_id,
            start_ms=int(segment['start_ms']),
            end_ms=int(segment['end_ms']),
            confidence=float(segment.get('confidence', 0.0)),
            source=segment.get('source', 'voice-diarization'),
        ))
    return result
