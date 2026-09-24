import { describe, expect, it } from 'vitest';
import { planSocialExperiment } from './social-experiment.js';

const pattern = {
  id: 'social-pattern:1' as never,
  sourceObservationIds: ['obs-1' as never],
  platforms: ['instagram'] as const,
  topic: 'pet portraits',
  hook: 'numbered',
  format: 'short-video',
  structure: 'numbered-list',
  audienceSignals: ['pet lovers'],
  confidence: 0.9,
};

describe('social experiment planning', () => {
  it('turns original social variants into an attribution-ready experiment', () => {
    const plan = planSocialExperiment({
      pattern,
      variants: [
        { id: 'variant-a' as never, patternId: pattern.id, platform: 'tiktok', objective: 'qualified clicks', audience: 'pet owners', patternMechanics: ['hook:numbered'], originalityRequirements: ['original'], experimentHypothesis: 'test', provenance: [pattern.id] },
        { id: 'variant-b' as never, patternId: pattern.id, platform: 'tiktok', objective: 'qualified clicks', audience: 'pet owners', patternMechanics: ['hook:numbered'], originalityRequirements: ['original'], experimentHypothesis: 'test', provenance: [pattern.id] },
      ],
      channel: 'tiktok',
      budgetGuardrail: 100,
    });

    expect(plan.creativeVariants).toHaveLength(2);
    expect(plan.successMetric).toBe('contribution_roas');
    expect(plan.requiredEvidence).toEqual(expect.arrayContaining(['attribution', 'revenue', 'contribution_margin']));
  });
});
