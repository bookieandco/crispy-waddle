import { createShotIndexEntry, type AudioObservation, type ShotIndexEntry, type TimeRange, type TranscriptObservation, type VisionObservation } from './multimodal-shot-index.js';

export type MultimodalAnalysis = {
  vision: VisionObservation[];
  transcript: TranscriptObservation[];
  audio: AudioObservation[];
};

export type ShotBoundary = TimeRange & { id: string };

export type MultimodalShotIndexer = {
  index(assetId: string, boundaries: ShotBoundary[], analysis: MultimodalAnalysis): ShotIndexEntry[];
};

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startSeconds < b.endSeconds && b.startSeconds < a.endSeconds;
}

export function createMultimodalShotIndexer(): MultimodalShotIndexer {
  return {
    index(assetId, boundaries, analysis) {
      return boundaries.map(boundary => createShotIndexEntry({
        id: `${assetId}:${boundary.id}`,
        assetId,
        time: { startSeconds: boundary.startSeconds, endSeconds: boundary.endSeconds },
        vision: analysis.vision.filter(item => overlaps(item.time, boundary)),
        transcript: analysis.transcript.filter(item => overlaps(item.time, boundary)),
        audio: analysis.audio.filter(item => overlaps(item.time, boundary)),
      }));
    },
  };
}
