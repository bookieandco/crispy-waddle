import { describe, expect, it } from 'vitest';
import { scanGrowthSignal } from './opportunity-scanner.js';

describe('TikTok -> DistributionOpportunity -> OpportunityScoringV1', () => {
  it('turns a TikTok signal into a scored experiment opportunity', () => {
    const opportunity = scanGrowthSignal({
      id: 'tiktok:rich-wallet:001',
      surfaceId: 'social:tiktok',
      topic: 'slim wallet UGC format',
      source: 'tiktok-api',
      observedAt: '2026-08-28T00:00:00.000Z',
      reach: 88,
      audienceFit: 91,
      momentum: 94,
      intent: 82,
      evidenceQuality: 90,
      competition: 42,
      costEfficiency: 86,
      conversionPotential: 84,
      engagementQuality: 89,
      recency: 96,
      repeatability: 93,
      nicheRelevance: 92,
      creativeNovelty: 78,
      monetizationPotential: 87,
      productionDifficulty: 95,
    });

    expect(opportunity).not.toBeNull();
    expect(opportunity?.surfaceId).toBe('social:tiktok');
    expect(opportunity?.recommendedAction).toBe('test');
    expect(opportunity?.score).toBe(89.22);
    expect(opportunity?.scoringV1?.opportunityId).toBe('distribution-opportunity:tiktok:rich-wallet:001');
    expect(opportunity?.scoringV1?.breakdown.velocity).toBe(94);
    expect(opportunity?.scoringV1?.breakdown.monetizationPotential).toBe(87);
    expect(opportunity?.scoringV1?.decision).toBe('prioritize');
    expect(opportunity?.evidenceSignalIds).toEqual(['tiktok:rich-wallet:001']);
  });

  it('preserves the existing null behavior for unknown surfaces', () => {
    expect(scanGrowthSignal({
      id: 'unknown:001',
      surfaceId: 'social:not-real',
      topic: 'unknown',
      source: 'test',
      observedAt: '2026-08-28T00:00:00.000Z',
      audienceFit: 50,
      momentum: 50,
      intent: 50,
      evidenceQuality: 50,
    })).toBeNull();
  });
});
