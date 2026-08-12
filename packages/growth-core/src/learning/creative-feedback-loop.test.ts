import { describe, expect, it } from 'vitest';
import { createCreativeLearningSignal } from './creative-feedback-loop.js';
import type { GrowthLearning } from './growth-learning.js';
import type { ExperimentAssessment } from '../experiments/experiment-intelligence.js';

const learning: GrowthLearning = {
  id: 'learning:experiment-1', sourceExperimentId: 'experiment-1', hypothesis: 'Test hook',
  winningVariantId: 'variant-a', evidenceScore: 0.9, confidence: 0.8,
  finding: 'Variant variant-a outperformed.', reusableSignals: { hook: 'problem-first' },
  evidenceEventIds: ['event-1'], status: 'validated',
};

const assessment: ExperimentAssessment = {
  experimentId: 'experiment-1', winnerVariantId: 'variant-a', evidenceScore: 0.9,
  confidence: 0.8, recommendation: 'promising',
};

describe('creative feedback loop', () => {
  it('turns validated experiment learning into a creative signal', () => {
    const signal = createCreativeLearningSignal(learning, assessment);
    expect(signal.action).toBe('promote');
    expect(signal.winningVariantId).toBe('variant-a');
    expect(signal.reusableSignals.hook).toBe('problem-first');
    expect(signal.evidenceEventIds).toEqual(['event-1']);
  });
});
