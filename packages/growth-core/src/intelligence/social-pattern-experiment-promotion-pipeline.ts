import type { GrowthId } from '../domain/types.js';
import { evaluateRecordedExperiment } from './social-pattern-experiment-evidence.js';
import type { PatternExperiment, PatternExperimentResult } from './social-pattern-experiment.js';
import { promoteValidatedPattern, type PromotedSocialPattern } from './social-pattern-promotion.js';
import type { PatternHypothesis } from './social-pattern-transfer.js';
import type { SocialPatternPromotionStore } from './social-pattern-promotion-store.js';
import type { PatternExperimentEvidenceStore } from './social-pattern-experiment-evidence.js';

export interface PatternExperimentPromotionPipelineResult {
  readonly evaluation: PatternExperimentResult;
  readonly promotion: PromotedSocialPattern | null;
}

/**
 * Evaluates only durable execution evidence and persists a promotion only when
 * the canonical evaluator and promotion gate both approve it. Caller input
 * cannot supply winner/promoted state or target identity.
 */
export async function evaluateAndPromoteRecordedExperiment(
  experiment: PatternExperiment,
  hypothesis: PatternHypothesis,
  executionId: GrowthId,
  evidenceStore: PatternExperimentEvidenceStore,
  promotionStore: SocialPatternPromotionStore,
): Promise<PatternExperimentPromotionPipelineResult | null> {
  if (hypothesis.id !== experiment.hypothesisId) return null;

  const evaluation = await evaluateRecordedExperiment(
    experiment,
    executionId,
    evidenceStore,
    (boundExperiment, observation) => {
      // Lazy import is unnecessary here: the evaluator is deterministic and
      // kept in the pattern-experiment module to preserve one source of truth.
      return evaluatePatternExperiment(boundExperiment, observation);
    },
  );

  if (!evaluation) return null;

  const promotion = promoteValidatedPattern(hypothesis, evaluation);
  if (!promotion) return { evaluation, promotion: null };

  await promotionStore.upsert({
    ...promotion,
    promotedAt: evaluation.evaluatedAt,
    experimentId: evaluation.experimentId,
  });

  return { evaluation, promotion };
}

import { evaluatePatternExperiment } from './social-pattern-experiment.js';
