import type { GrowthId } from '../domain/types.js';

export interface ExperimentVariantResult {
  variantId: GrowthId;
  exposures: number;
  conversions: number;
  contributionMargin: number;
}

export interface Experiment {
  id: GrowthId;
  hypothesis: string;
  primaryMetric: 'conversion_rate' | 'contribution_margin';
  variants: ExperimentVariantResult[];
}

export interface ExperimentAssessment {
  experimentId: GrowthId;
  winnerVariantId?: GrowthId;
  evidenceScore: number;
  confidence: number;
  recommendation: 'promising' | 'inconclusive' | 'underperforming';
}

export function assessExperiment(experiment: Experiment): ExperimentAssessment {
  const eligible = experiment.variants.filter((variant) => variant.exposures > 0);
  if (eligible.length < 2) {
    return { experimentId: experiment.id, evidenceScore: 0, confidence: 0, recommendation: 'inconclusive' };
  }

  const metric = (variant: ExperimentVariantResult) =>
    experiment.primaryMetric === 'conversion_rate'
      ? variant.conversions / variant.exposures
      : variant.contributionMargin / variant.exposures;

  const ranked = [...eligible].sort((a, b) => metric(b) - metric(a));
  const winner = ranked[0];
  const runnerUp = ranked[1];
  const winnerMetric = metric(winner);
  const runnerMetric = metric(runnerUp);
  const lift = runnerMetric === 0 ? (winnerMetric > 0 ? 1 : 0) : (winnerMetric - runnerMetric) / Math.abs(runnerMetric);
  const totalExposure = eligible.reduce((sum, variant) => sum + variant.exposures, 0);
  const evidenceScore = Math.min(1, totalExposure / 1000);
  const confidence = Math.min(1, evidenceScore * (0.5 + Math.min(0.5, Math.max(0, lift))));

  return {
    experimentId: experiment.id,
    winnerVariantId: winner.variantId,
    evidenceScore,
    confidence,
    recommendation: confidence >= 0.7 && lift > 0.1
      ? 'promising'
      : confidence < 0.4
        ? 'inconclusive'
        : 'underperforming',
  };
}
