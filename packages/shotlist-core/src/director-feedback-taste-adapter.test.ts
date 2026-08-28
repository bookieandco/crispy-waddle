import { describe, expect, it } from 'vitest';
import { feedbackToTasteSignal } from './director-feedback-taste-adapter.js';

describe('feedbackToTasteSignal', () => {
  it('turns positive take feedback into scoped taste evidence', () => {
    expect(feedbackToTasteSignal({
      takeId: 'take-1', shotId: 'shot-1', reaction: 'love', observedAt: '2026-08-27T00:00:00.000Z',
    })).toMatchObject({
      subject: 'shot-1', category: 'style', sentiment: 100, confidence: 40,
      sourceExperienceIds: ['director:take:take-1:feedback'],
    });
  });

  it('keeps one take below the confidence threshold for personality learning', () => {
    expect(feedbackToTasteSignal({
      takeId: 'take-2', shotId: 'shot-2', reaction: 'like', observedAt: '2026-08-27T00:00:00.000Z',
    }).confidence).toBe(40);
  });
});
