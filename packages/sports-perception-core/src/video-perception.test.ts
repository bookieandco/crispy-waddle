import { describe, expect, it } from 'vitest';
import { validateDetection, validateIdentityHypothesis, validateTrack } from './video-perception.js';

const frame = {
  videoId: 'video-1',
  frameNumber: 10,
  timestamp: '2026-09-03T12:00:10.000Z',
  mediaTimeMs: 10000,
  contentHash: 'frame-hash',
};

describe('visual perception contracts', () => {
  it('requires detector lineage and bounded confidence', () => {
    expect(() => validateDetection({
      detectionId: 'd1', frame, class: 'PLAYER', confidence: 0.92,
      box: { x: 1, y: 2, width: 50, height: 100 }, modelId: 'detector', modelVersion: '1', evidenceIds: ['e1'],
    })).not.toThrow();
    expect(() => validateDetection({
      detectionId: 'd2', frame, class: 'PLAYER', confidence: 1.1,
      box: { x: 1, y: 2, width: 50, height: 100 }, modelId: 'detector', modelVersion: '1', evidenceIds: ['e2'],
    })).toThrow();
  });

  it('treats tracking as its own lineage boundary', () => {
    expect(() => validateTrack({
      trackId: 't1', frame, detectionId: 'd1', class: 'PLAYER',
      box: { x: 1, y: 2, width: 50, height: 100 }, associationConfidence: 0.8,
      trackerId: 'bytetrack', trackerVersion: '1', evidenceIds: ['e1'],
    })).not.toThrow();
  });

  it('does not allow an identity hypothesis without evidence', () => {
    expect(() => validateIdentityHypothesis({
      trackId: 't1', candidateCanonicalIds: ['player-1'], method: 'FACE_EMBEDDING',
      confidence: 0.9, asOf: frame.timestamp, evidenceIds: [],
    })).toThrow();
  });
});
