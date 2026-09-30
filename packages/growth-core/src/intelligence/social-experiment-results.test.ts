import { describe, expect, it } from 'vitest';
import { ingestSocialExperimentResult } from './social-experiment-results.js';

describe('social experiment results', () => {
  it('calculates funnel metrics and creates attributable knowledge', () => {
    const outcome = ingestSocialExperimentResult({ experimentId: 'exp:1' as never, creativePackId: 'pack:1' as never, platform: 'instagram', topic: 'pet portraits', observedAt: '2026-08-30T00:00:00Z', impressions: 1000, clicks: 100, conversions: 10, revenue: 250, spend: 100, evidence: ['creative:1' as never] });
    expect(outcome.ctr).toBe(0.1);
    expect(outcome.conversionRate).toBe(0.1);
    expect(outcome.roas).toBe(2.5);
    expect(outcome.knowledge.signalType).toBe('experiment');
    expect(outcome.knowledge.evidence).toEqual(expect.arrayContaining(['exp:1', 'pack:1', 'creative:1']));
  });

  it('does not manufacture ROAS when there is no spend', () => {
    const outcome = ingestSocialExperimentResult({ experimentId: 'exp:2' as never, creativePackId: 'pack:2' as never, platform: 'tiktok', topic: 'pet gifts', observedAt: '2026-08-30T00:00:00Z', impressions: 10, clicks: 2, conversions: 1, revenue: 50, spend: 0, evidence: [] });
    expect(outcome.roas).toBeNull();
  });
});
