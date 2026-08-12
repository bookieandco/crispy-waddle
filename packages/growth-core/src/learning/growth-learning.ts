import type { GrowthId } from '../domain/types.js';
import type { Experiment, ExperimentAssessment } from '../experiments/experiment-intelligence.js';

export interface GrowthLearning {
  id: GrowthId;
  sourceExperimentId: GrowthId;
  hypothesis: string;
  winningVariantId?: GrowthId;
  evidenceScore: number;
  confidence: number;
  finding: string;
  reusableSignals: Record<string, string>;
  evidenceEventIds: GrowthId[];
  status: 'provisional' | 'validated' | 'rejected';
}

export function createGrowthLearning(
  experiment: Experiment,
  assessment: ExperimentAssessment,
  signals: Record<string, string>,
  evidenceEventIds: GrowthId[],
): GrowthLearning {
  const status = assessment.recommendation === 'promising'
    ? 'validated'
    : assessment.recommendation === 'underperforming'
      ? 'rejected'
      : 'provisional';

  const finding = assessment.winnerVariantId
    ? `Variant ${assessment.winnerVariantId} outperformed the comparison variants on ${experiment.primaryMetric}.`
    : 'The experiment does not yet provide sufficient evidence for a winner.';

  return {
    id: `learning:${experiment.id}`,
    sourceExperimentId: experiment.id,
    hypothesis: experiment.hypothesis,
    winningVariantId: assessment.winnerVariantId,
    evidenceScore: assessment.evidenceScore,
    confidence: assessment.confidence,
    finding,
    reusableSignals: { ...signals },
    evidenceEventIds: [...evidenceEventIds],
    status,
  };
}
