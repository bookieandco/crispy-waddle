import { describe, expect, it } from 'vitest';
import { feedbackToRecipeTasteSignals } from './director-feedback-recipe.js';

describe('feedbackToRecipeTasteSignals', () => {
  it('attributes a positive reaction to the controls that produced the take', () => {
    const signals = feedbackToRecipeTasteSignals(
      { takeId: 'take-1', shotId: 'shot-1', reaction: 'love', observedAt: '2026-08-27T00:00:00.000Z' },
      { controls: { framing: 'close-up', lightingMood: 'moody', lookPreset: 'film-noir' } },
    );
    expect(signals).toHaveLength(3);
    expect(signals.map((s) => s.subject)).toEqual(['close-up', 'moody', 'film-noir']);
    expect(signals.every((s) => s.sentiment === 100 && s.confidence === 40)).toBe(true);
  });

  it('does not create evidence for controls that were not selected', () => {
    const signals = feedbackToRecipeTasteSignals(
      { takeId: 'take-2', shotId: 'shot-2', reaction: 'dislike', observedAt: '2026-08-27T00:00:00.000Z' },
      { controls: { framing: 'wide' } },
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ subject: 'wide', sentiment: -60 });
  });
});
