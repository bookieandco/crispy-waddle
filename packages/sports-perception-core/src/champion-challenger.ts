import type { ValidatedLearningRecord } from './validated-learning-store.js';

export interface ModelEvaluationSummary {
  modelVersion: string;
  sampleSize: number;
  meanBrierScore: number;
  meanLogLoss: number;
  meanAbsoluteResidual: number;
}

export interface ChampionChallengerDecision {
  champion: string;
  challenger: string;
  eligibleForPromotion: boolean;
  reasons: readonly string[];
}

export function evaluateChampionChallenger(
  champion: ModelEvaluationSummary,
  challenger: ModelEvaluationSummary,
  records: readonly ValidatedLearningRecord[],
  minimumSamples = 100,
): ChampionChallengerDecision {
  const signals = records.filter((record) => record.target === 'MODEL_CHALLENGER' && record.disposition === 'VALIDATED');
  const reasons: string[] = [];
  if (signals.length === 0) reasons.push('No validated model-challenger attribution signals');
  if (challenger.sampleSize < minimumSamples || champion.sampleSize < minimumSamples) reasons.push('Insufficient out-of-sample evaluation');
  if (challenger.meanBrierScore >= champion.meanBrierScore) reasons.push('Challenger does not improve Brier score');
  if (challenger.meanLogLoss >= champion.meanLogLoss) reasons.push('Challenger does not improve log loss');
  if (challenger.meanAbsoluteResidual >= champion.meanAbsoluteResidual) reasons.push('Challenger does not improve mean absolute residual');
  return Object.freeze({ champion: champion.modelVersion, challenger: challenger.modelVersion, eligibleForPromotion: reasons.length === 0, reasons: Object.freeze(reasons) });
}
