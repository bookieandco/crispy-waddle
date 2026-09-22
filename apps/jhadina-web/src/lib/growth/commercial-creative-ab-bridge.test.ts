import { describe, expect, it } from 'vitest';
import { assessGrowthEvidenceFeedHealth } from '@jhadina/growth-core';
import { assessDirectorCommercialCreativeExperiment } from './commercial-creative-ab-bridge';

describe('Director commercial creative -> Growth A/B bridge', () => {
  const healthyFeed = assessGrowthEvidenceFeedHealth({
    id: 'health:commercial-ab',
    source: 'meta+capi+orders',
    assetRef: 'multiplier:zesta-hooks',
    observedAt: '2026-09-22T19:00:00.000Z',
    checkedAt: '2026-09-22T19:01:00.000Z',
    freshnessSlaSeconds: 600,
    completeness: 0.995,
    monitorCoverage: 0.95,
    activeIncidentCount: 0,
    upstreamIssueCount: 0,
    schemaAnomaly: false,
    volumeAnomaly: false,
    lineageComplete: true,
    evidenceRefs: ['health:freshness', 'health:lineage'],
  });

  const plan = {
    id: 'multiplier:zesta-hooks',
    projectId: 'ad-project',
    sourceCreativeId: 'creative:control',
    experimentIsolation: 'single-axis' as const,
    authority: 'PRODUCTION_PLAN_ONLY' as const,
    variants: [
      {
        id: 'creative:horse-hook',
        parentCreativeId: 'creative:control',
        mutationAxis: 'hook' as const,
        replacementRef: 'hook:horse',
        replacementEvidenceIds: ['creative:hook:horse'],
        replacementRightsEvidenceIds: [],
        preserveProductIdentity: true,
        preserveCharacterIdentity: true,
        preserveStoryStructure: true,
      },
      {
        id: 'creative:train-hook',
        parentCreativeId: 'creative:control',
        mutationAxis: 'hook' as const,
        replacementRef: 'hook:train',
        replacementEvidenceIds: ['creative:hook:train'],
        replacementRightsEvidenceIds: [],
        preserveProductIdentity: true,
        preserveCharacterIdentity: true,
        preserveStoryStructure: true,
      },
    ],
  };

  it('runs a multi-arm test while keeping the source creative as control', () => {
    const result = assessDirectorCommercialCreativeExperiment({
      plan,
      dataHealth: healthyFeed,
      observations: [
        { variantId: 'creative:control', exposures: 5000, conversions: 250, spend: 2000, contributionMargin: 4200 },
        { variantId: 'creative:horse-hook', exposures: 5000, conversions: 350, spend: 2100, contributionMargin: 5600 },
        { variantId: 'creative:train-hook', exposures: 5000, conversions: 270, spend: 2050, contributionMargin: 4300 },
      ],
      policy: {
        minimumExposuresPerVariant: 1000,
        significanceLevel: 0.05,
        minimumRelativeLift: 0.1,
        minimumContributionRoas: 1.5,
        maximumCac: 10,
      },
    });

    expect(result.status).toBe('supported-lift');
    expect(result.bestSupportedTreatmentId).toBe('creative:horse-hook');
    expect(result.authority).toBe('LEARNING_EVIDENCE_ONLY');
  });

  it('refuses causal winner claims from mixed-axis exploratory variants', () => {
    expect(() => assessDirectorCommercialCreativeExperiment({
      plan: {
        ...plan,
        experimentIsolation: 'multi-axis-exploratory',
        variants: [
          plan.variants[0]!,
          { ...plan.variants[1]!, mutationAxis: 'cta' as const },
        ],
      },
      dataHealth: healthyFeed,
      dataHealth: healthyFeed,
      observations: [],
      policy: { minimumExposuresPerVariant: 1000 },
    })).toThrow('GROWTH_AD_MULTIPLIER_CAUSAL_TEST_REQUIRES_SINGLE_AXIS');
  });

  it('rejects performance rows that do not belong to the experiment lineage', () => {
    expect(() => assessDirectorCommercialCreativeExperiment({
      plan,
      dataHealth: healthyFeed,
      dataHealth: healthyFeed,
      observations: [
        { variantId: 'creative:unknown', exposures: 1000, conversions: 100 },
      ],
      policy: { minimumExposuresPerVariant: 1000 },
    })).toThrow('GROWTH_AD_MULTIPLIER_OBSERVATION_UNKNOWN:creative:unknown');
  });
  it('refuses to learn from an unhealthy attribution feed even when performance rows exist', () => {
    const unhealthyFeed = assessGrowthEvidenceFeedHealth({
      id: 'health:commercial-ab-bad',
      source: 'meta+capi+orders',
      assetRef: 'multiplier:zesta-hooks',
      observedAt: '2026-09-22T17:00:00.000Z',
      checkedAt: '2026-09-22T19:01:00.000Z',
      freshnessSlaSeconds: 600,
      completeness: 0.8,
      monitorCoverage: 0.3,
      activeIncidentCount: 1,
      upstreamIssueCount: 2,
      schemaAnomaly: true,
      volumeAnomaly: true,
      lineageComplete: false,
      evidenceRefs: ['incident:attribution'],
    });

    expect(() => assessDirectorCommercialCreativeExperiment({
      plan,
      dataHealth: unhealthyFeed,
      observations: [
        { variantId: 'creative:control', exposures: 5000, conversions: 250 },
        { variantId: 'creative:horse-hook', exposures: 5000, conversions: 350 },
        { variantId: 'creative:train-hook', exposures: 5000, conversions: 270 },
      ],
      policy: { minimumExposuresPerVariant: 1000 },
    })).toThrow();
  });
});
