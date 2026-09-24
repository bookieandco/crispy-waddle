import { describe, expect, it } from 'vitest';
import { selectCreativePatterns } from './creative-pattern-selection.js';

describe('creative pattern selection', () => {
  it('prefers high-performing patterns matching the target audience', () => {
    const result = selectCreativePatterns({ id: 'convergence:1' as never, trendId: 'cluster:1' as never, buyerIntentScore: 0.8, trendScore: 0.9, convergenceScore: 0.85, audienceIds: ['audience:1' as never], rationale: [], requiresHumanReview: true }, [
      { id: 'pattern:low' as never, hookStyle: 'question', format: 'post', emotionalFrame: 'curiosity', audienceIds: [], performanceScore: 0.9, provenance: ['source:a'] },
      { id: 'pattern:match' as never, hookStyle: 'story', format: 'short-video', emotionalFrame: 'humor', audienceIds: ['audience:1' as never], performanceScore: 0.8, provenance: ['source:b'] },
    ], 1);
    expect(result.patternIds).toEqual(['pattern:match']);
    expect(result.adaptationRequired).toBe(true);
    expect(result.requiresHumanReview).toBe(true);
  });
});
