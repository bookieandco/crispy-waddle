import { describe, expect, it } from 'vitest';
import { createCorrelatedStudyNote } from './correlated-study-note.js';
import type { Observation } from './observation-bus.js';
import type { ObservationCluster } from './multimodal-observation-correlator.js';

const makeObservation = (id: string, kind: Observation['kind'], startSeconds: number, confidence: number, payload: Record<string, unknown>): Observation => ({
  id,
  assetId: 'asset-1',
  kind,
  time: { startSeconds, endSeconds: startSeconds + 1 },
  payload,
  confidence,
  provenance: { provider: 'test', source: 'synthetic' },
});

describe('createCorrelatedStudyNote', () => {
  it('keeps timecoded evidence and produces a readable summary', () => {
    const cluster: ObservationCluster = {
      startSeconds: 10,
      endSeconds: 13,
      observations: [
        makeObservation('vision', 'visual', 10, 0.8, { label: 'two people' }),
        makeObservation('speech', 'speech', 11, 1, { text: 'We need to talk' }),
      ],
    };

    const note = createCorrelatedStudyNote(cluster);
    expect(note.startSeconds).toBe(10);
    expect(note.endSeconds).toBe(13);
    expect(note.evidenceCount).toBe(2);
    expect(note.confidence).toBeCloseTo(0.9);
    expect(note.summary).toContain('two people');
    expect(note.summary).toContain('We need to talk');
  });
});
