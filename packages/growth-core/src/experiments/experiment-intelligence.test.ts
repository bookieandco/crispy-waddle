import { describe, expect, it } from 'vitest';
import { assessExperiment } from './experiment-intelligence.js';

describe('experiment intelligence', () => {
  it('identifies a sufficiently evidenced winner', () => {
    const result = assessExperiment({
      id: 'exp-1',
      hypothesis: 'Demo creative improves conversion',
      primaryMetric: 'conversion_rate',
      variants: [
        { variantId: 'control', exposures: 500, conversions: 25, contributionMargin: 1000 },
        { variantId: 'demo', exposures: 500, conversions: 40, contributionMargin: 1500 },
      ],
    });

    expect(result.winnerVariantId).toBe('demo');
    expect(result.recommendation).toBe('promising');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('does not declare a winner with insufficient exposure', () => {
    const result = assessExperiment({
      id: 'exp-2',
      hypothesis: 'New hook wins',
      primaryMetric: 'conversion_rate',
      variants: [
        { variantId: 'control', exposures: 20, conversions: 1, contributionMargin: 10 },
        { variantId: 'new-hook', exposures: 20, conversions: 2, contributionMargin: 20 },
      ],
    });

    expect(result.recommendation).toBe('inconclusive');
  });

  it('can assess contribution margin instead of conversion rate', () => {
    const result = assessExperiment({
      id: 'exp-3',
      hypothesis: 'Higher price improves economics',
      primaryMetric: 'contribution_margin',
      variants: [
        { variantId: 'a', exposures: 500, conversions: 30, contributionMargin: 1000 },
        { variantId: 'b', exposures: 500, conversions: 28, contributionMargin: 1600 },
      ],
    });

    expect(result.winnerVariantId).toBe('b');
  });
});
