import { describe, expect, it } from 'vitest';
import { scoreGrowthOpportunity } from './growth-opportunity-score.js';

describe('growth opportunity scoring', () => {
  it('recommends scale for strong economics and evidence', () => {
    const result = scoreGrowthOpportunity({ id: 'creative-a', contributionMargin: 1000, ltvPerCustomer: 250, sampleSize: 200, confidence: 0.9, trend: 0.8 });
    expect(result.recommendation).toBe('scale');
  });

  it('recommends test when evidence is insufficient', () => {
    const result = scoreGrowthOpportunity({ id: 'creative-b', contributionMargin: 100, ltvPerCustomer: 50, sampleSize: 10, confidence: 0.4, trend: 0.5 });
    expect(result.recommendation).toBe('test');
  });

  it('recommends stop when economics are persistently negative', () => {
    const result = scoreGrowthOpportunity({ id: 'creative-c', contributionMargin: -100, ltvPerCustomer: -25, sampleSize: 200, confidence: 0.9, trend: -0.5 });
    expect(result.recommendation).toBe('stop');
  });

  it('treats high policy risk as a stop regardless of performance', () => {
    const result = scoreGrowthOpportunity({ id: 'creative-d', contributionMargin: 1000, ltvPerCustomer: 500, sampleSize: 500, confidence: 1, trend: 1, policyRisk: 0.9 });
    expect(result.recommendation).toBe('stop');
  });
});
