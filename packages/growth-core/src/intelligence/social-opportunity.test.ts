import { describe, expect, it } from 'vitest';
import { scoreSocialOpportunity } from './social-opportunity.js';

const buyer = {
  id: 'active-buyers:pet portraits' as never,
  topic: 'pet portraits',
  platforms: ['instagram', 'tiktok'] as const,
  signalCount: 8,
  highIntentCount: 6,
  recencyScore: 0.9,
  confidence: 0.9,
  evidence: ['buyer-signal:1' as never],
};

describe('social opportunity scoring', () => {
  it('escalates a strong low-risk opportunity', () => {
    const result = scoreSocialOpportunity({ buyerCluster: buyer, brandFit: 0.9, offerFit: 0.9, policyRisk: 0, executionReadiness: 0.9 });
    expect(result.decision).toBe('escalate');
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it('keeps high-risk opportunities in observe mode', () => {
    const result = scoreSocialOpportunity({ buyerCluster: buyer, brandFit: 1, offerFit: 1, policyRisk: 1, executionReadiness: 1 });
    expect(result.decision).toBe('observe');
  });
});
