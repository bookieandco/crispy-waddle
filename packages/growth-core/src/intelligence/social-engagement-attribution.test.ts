import { describe, expect, it } from 'vitest';
import { scoreCommentEngagement } from './social-engagement-attribution.js';

describe('social engagement attribution', () => {
  it('keeps attention, intent and conversion distinct', () => {
    const score = scoreCommentEngagement({ commentId: 'c:1' as never, accountId: 'a:1' as never, platform: 'instagram', observedAt: '2026-08-30T00:00:00Z', replies: 20, likes: 100, profileVisits: 0, follows: 0, linkClicks: 0, conversions: 0, revenue: 0 });
    expect(score.attentionScore).toBeGreaterThan(0);
    expect(score.intentScore).toBe(0);
    expect(score.conversionScore).toBe(0);
  });

  it('recognizes downstream commercial behavior', () => {
    const score = scoreCommentEngagement({ commentId: 'c:2' as never, accountId: 'a:1' as never, platform: 'instagram', observedAt: '2026-08-30T00:00:00Z', replies: 2, likes: 4, profileVisits: 5, follows: 2, linkClicks: 4, conversions: 2, revenue: 200 });
    expect(score.intentScore).toBeGreaterThan(0);
    expect(score.conversionScore).toBeGreaterThan(0);
    expect(score.revenue).toBe(200);
  });
});
