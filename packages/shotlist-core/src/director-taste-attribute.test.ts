import { describe, expect, it } from 'vitest';
import { feedbackToAttributeTasteSignals } from './director-taste-attribute.js';

describe('feedbackToAttributeTasteSignals', () => {
  it('preserves the exact directing dimension for each learned choice', () => {
    const signals = feedbackToAttributeTasteSignals(
      { takeId: 't1', shotId: 's1', reaction: 'love', observedAt: '2026-08-27T00:00:00.000Z' },
      { framing: 'close-up', lightingMood: 'bright', cameraMovement: 'static' } as any,
    );
    expect(signals.map((s) => [s.attribute, s.subject])).toEqual([
      ['framing', 'close-up'],
      ['lightingMood', 'bright'],
      ['cameraMovement', 'static'],
    ]);
  });
});
