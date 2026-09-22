import { describe, expect, it } from 'vitest';
import { assessDirectorCommercialCreativeExperiment } from './commercial-creative-ab-bridge';

describe('Director commercial creative -> Growth A/B bridge', () => {
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
      observations: [],
      policy: { minimumExposuresPerVariant: 1000 },
    })).toThrow('GROWTH_AD_MULTIPLIER_CAUSAL_TEST_REQUIRES_SINGLE_AXIS');
  });

  it('rejects performance rows that do not belong to the experiment lineage', () => {
    expect(() => assessDirectorCommercialCreativeExperiment({
      plan,
      observations: [
        { variantId: 'creative:unknown', exposures: 1000, conversions: 100 },
      ],
      policy: { minimumExposuresPerVariant: 1000 },
    })).toThrow('GROWTH_AD_MULTIPLIER_OBSERVATION_UNKNOWN:creative:unknown');
  });
});
