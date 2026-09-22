import type { AdMultiplierPlan } from '@jhadina/director-core';
import {
  assessCreativeAbExperiment,
  assertGrowthEvidenceHealthyForLearning,
  type CreativeAbAssessment,
  type CreativeAbVariantObservation,
  type GrowthEvidenceFeedHealthAssessment,
} from '@jhadina/growth-core';

export interface CommercialCreativeAbPolicy {
  minimumExposuresPerVariant: number;
  significanceLevel?: number;
  minimumRelativeLift?: number;
  minimumContributionRoas?: number;
  maximumCac?: number;
}

export function assessDirectorCommercialCreativeExperiment(input: {
  plan: AdMultiplierPlan;
  observations: readonly CreativeAbVariantObservation[];
  dataHealth: GrowthEvidenceFeedHealthAssessment;
  policy: CommercialCreativeAbPolicy;
}): CreativeAbAssessment {
  assertGrowthEvidenceHealthyForLearning(input.dataHealth);
  if (input.plan.experimentIsolation !== 'single-axis') {
    throw new Error('GROWTH_AD_MULTIPLIER_CAUSAL_TEST_REQUIRES_SINGLE_AXIS');
  }
  if (!input.plan.sourceCreativeId.trim()) {
    throw new Error('GROWTH_AD_MULTIPLIER_CONTROL_REQUIRED');
  }
  if (!input.plan.variants.length) {
    throw new Error('GROWTH_AD_MULTIPLIER_TREATMENTS_REQUIRED');
  }

  const axes = new Set(input.plan.variants.map((variant) => variant.mutationAxis));
  if (axes.size !== 1) {
    throw new Error('GROWTH_AD_MULTIPLIER_CAUSAL_TEST_AXIS_MISMATCH');
  }

  const treatmentVariantIds = input.plan.variants.map((variant) => variant.id);
  const expected = new Set([input.plan.sourceCreativeId, ...treatmentVariantIds]);
  for (const observation of input.observations) {
    if (!expected.has(observation.variantId)) {
      throw new Error(`GROWTH_AD_MULTIPLIER_OBSERVATION_UNKNOWN:${observation.variantId}`);
    }
  }

  return assessCreativeAbExperiment({
    id: `growth-ab:${input.plan.id}`,
    controlVariantId: input.plan.sourceCreativeId,
    treatmentVariantIds,
    observations: input.observations,
    minimumExposuresPerVariant: input.policy.minimumExposuresPerVariant,
    significanceLevel: input.policy.significanceLevel,
    minimumRelativeLift: input.policy.minimumRelativeLift,
    minimumContributionRoas: input.policy.minimumContributionRoas,
    maximumCac: input.policy.maximumCac,
  });
}
