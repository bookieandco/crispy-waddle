import { describe, expect, it } from 'vitest';
import { createCreativeBrief } from './creative-brief.js';
import type { GrowthLearning } from '../learning/growth-learning.js';

const learning: GrowthLearning = {
  id: 'learning:exp-1',
  sourceExperimentId: 'exp-1',
  hypothesis: 'Problem-first demo increases profitable conversions',
  winningVariantId: 'demo',
  evidenceScore: 0.9,
  confidence: 0.85,
  finding: 'The demo variant outperformed the comparison variant on contribution margin.',
  reusableSignals: { audience: 'new customers', offer: 'starter offer', hook: 'problem-first', format: 'UGC demo', channel: 'meta' },
  evidenceEventIds: ['event-1'],
  status: 'validated',
};

describe('creative brief generation', () => {
  it('turns validated learning into an evidence-backed brief', () => {
    const brief = createCreativeBrief([learning], 'Acquire profitable first-time customers');

    expect(brief.objective).toBe('Acquire profitable first-time customers');
    expect(brief.hook).toBe('problem-first');
    expect(brief.format).toBe('UGC demo');
    expect(brief.supportingLearningIds).toEqual(['learning:exp-1']);
    expect(brief.evidenceEventIds).toEqual(['event-1']);
    expect(brief.status).toBe('draft');
  });

  it('does not present unvalidated learning as evidence', () => {
    const brief = createCreativeBrief([{ ...learning, status: 'provisional' }], 'Explore');
    expect(brief.supportingLearningIds).toEqual([]);
    expect(brief.evidenceEventIds).toEqual([]);
  });
});
