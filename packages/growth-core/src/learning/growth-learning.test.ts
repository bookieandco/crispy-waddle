import { describe, expect, it } from 'vitest';
import { createGrowthLearning } from './growth-learning.js';
import type { Experiment, ExperimentAssessment } from '../experiments/experiment-intelligence.js';

const experiment: Experiment = {
  id: 'exp-1',
  hypothesis: 'Problem-first demo increases profitable conversions',
  primaryMetric: 'contribution_margin',
  variants: [
    { variantId: 'control', exposures: 500, conversions: 20, contributionMargin: 800 },
    { variantId: 'demo', exposures: 500, conversions: 24, contributionMargin: 1400 },
  ],
};

describe('growth learning', () => {
  it('creates validated reusable knowledge from a promising experiment', () => {
    const assessment: ExperimentAssessment = {
      experimentId: 'exp-1',
      winnerVariantId: 'demo',
      evidenceScore: 1,
      confidence: 0.9,
      recommendation: 'promising',
    };

    const learning = createGrowthLearning(
      experiment,
      assessment,
      { hook: 'problem-first', format: 'UGC demo', audience: 'new customers' },
      ['event-1', 'event-2'],
    );

    expect(learning.status).toBe('validated');
    expect(learning.winningVariantId).toBe('demo');
    expect(learning.reusableSignals.hook).toBe('problem-first');
    expect(learning.evidenceEventIds).toEqual(['event-1', 'event-2']);
  });

  it('keeps weak evidence provisional', () => {
    const assessment: ExperimentAssessment = {
      experimentId: 'exp-1',
      evidenceScore: 0.1,
      confidence: 0.2,
      recommendation: 'inconclusive',
    };

    expect(createGrowthLearning(experiment, assessment, {}, []).status).toBe('provisional');
  });
});
