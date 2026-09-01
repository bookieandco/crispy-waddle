import { describe, expect, it } from 'vitest';
import { summarizeSocialKnowledge } from './social-knowledge.js';

describe('social knowledge', () => {
  it('aggregates history by topic with confidence weighting and trend', () => {
    const summary = summarizeSocialKnowledge([
      { id: '1' as never, topic: 'Pet Portraits', platform: 'instagram', observedAt: '2026-08-01T00:00:00Z', signalType: 'performance', value: 1, confidence: 0.5, evidence: ['e1' as never] },
      { id: '2' as never, topic: 'pet portraits', platform: 'tiktok', observedAt: '2026-08-15T00:00:00Z', signalType: 'buyer_intent', value: 2, confidence: 1, evidence: ['e2' as never] },
      { id: '3' as never, topic: 'pet portraits', platform: 'instagram', observedAt: '2026-08-29T00:00:00Z', signalType: 'experiment', value: 4, confidence: 1, evidence: ['e3' as never] },
    ]);

    expect(summary).toHaveLength(1);
    expect(summary[0].observationCount).toBe(3);
    expect(summary[0].platforms).toEqual(expect.arrayContaining(['instagram', 'tiktok']));
    expect(summary[0].trend).toBe('rising');
    expect(summary[0].evidence).toEqual(expect.arrayContaining(['e1', 'e2', 'e3']));
  });
});
