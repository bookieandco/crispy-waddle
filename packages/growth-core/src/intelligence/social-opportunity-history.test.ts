import { describe, expect, it } from 'vitest';
import { scoreHistoricalSocialOpportunity } from './social-opportunity-history.js';

const buyer = { id: 'buyers:1' as never, topic: 'pet portraits', platforms: ['instagram', 'tiktok'] as const, signalCount: 20, highIntentCount: 15, recencyScore: 0.9, confidence: 0.9, evidence: ['buyer:1' as never] };

describe('historical social opportunity scoring', () => {
  it('adds historical evidence without bypassing policy risk', () => {
    const result = scoreHistoricalSocialOpportunity({ buyerCluster: buyer, brandFit: 0.9, offerFit: 0.9, executionReadiness: 0.9, policyRisk: 0, historicalKnowledge: { topic: 'pet portraits', observationCount: 100, averageValue: 1, weightedValue: 2, confidence: 0.95, platforms: ['instagram', 'tiktok'], lastObservedAt: '2026-08-30T00:00:00Z', trend: 'rising', evidence: ['history:1' as never] } });
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.evidence).toEqual(expect.arrayContaining(['history:1']));
    expect(result.components.historicalSignal).toBeGreaterThan(0);
  });

  it('cannot turn high policy risk into an escalation', () => {
    const result = scoreHistoricalSocialOpportunity({ buyerCluster: buyer, brandFit: 1, offerFit: 1, executionReadiness: 1, policyRisk: 1, historicalKnowledge: { topic: 'pet portraits', observationCount: 1000, averageValue: 10, weightedValue: 10, confidence: 1, platforms: ['instagram'], lastObservedAt: '2026-08-30T00:00:00Z', trend: 'rising', evidence: [] } });
    expect(result.decision).toBe('observe');
  });
});
