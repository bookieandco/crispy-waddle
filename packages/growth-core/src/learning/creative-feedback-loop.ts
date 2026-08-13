import type { GrowthId } from '../domain/types.js';
import type { ExperimentAssessment } from '../experiments/experiment-intelligence.js';
import type { GrowthLearning } from './growth-learning.js';

export interface CreativeLearningSignal {
  id: GrowthId;
  sourceLearningId: GrowthId;
  action: 'promote' | 'iterate' | 'archive';
  winningVariantId?: GrowthId;
  briefInstruction: string;
  reusableSignals: Record<string, string>;
  evidenceEventIds: GrowthId[];
}

export function createCreativeLearningSignal(
  learning: GrowthLearning,
  assessment: ExperimentAssessment,
): CreativeLearningSignal {
  const action = assessment.recommendation === 'promising'
    ? 'promote'
    : assessment.recommendation === 'underperforming'
      ? 'archive'
      : 'iterate';

  const briefInstruction = assessment.winnerVariantId
    ? `Use ${assessment.winnerVariantId} as the control signal for the next creative brief; preserve validated signals and test one meaningful change.`
    : 'Create the next brief around the unresolved hypothesis and test one meaningful change while preserving the existing control.';

  return {
    id: `creative-signal:${learning.id}`,
    sourceLearningId: learning.id,
    action,
    winningVariantId: assessment.winnerVariantId,
    briefInstruction,
    reusableSignals: { ...learning.reusableSignals },
    evidenceEventIds: [...learning.evidenceEventIds],
  };
}
