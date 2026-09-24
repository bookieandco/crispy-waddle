import { describe, expect, it } from 'vitest';
import { buildCreativeAdaptationPlan } from './creative-adaptation.js';

describe('creative adaptation', () => {
  it('preserves performance structure while requiring account-specific transformation', () => {
    const result = buildCreativeAdaptationPlan({
      id: 'request:1' as never,
      accountId: 'account:pupsonstuff' as never,
      brandId: 'brand:pupsonstuff' as never,
      tone: 'mascot',
      audienceIds: ['audience:1' as never],
      constraints: [],
      pattern: { id: 'pattern:1' as never, hookStyle: 'question', format: 'short-video', emotionalFrame: 'humor', audienceIds: ['audience:1' as never], performanceScore: 0.9, provenance: ['source:1'] },
    });
    expect(result.preserve).toContain('hook_style');
    expect(result.transform).toContain('account_specific_tone');
    expect(result.prohibit).toContain('verbatim_copy');
    expect(result.prohibit).toContain('source_identity_impersonation');
    expect(result.tone).toBe('mascot');
    expect(result.requiresHumanReview).toBe(true);
  });
});
