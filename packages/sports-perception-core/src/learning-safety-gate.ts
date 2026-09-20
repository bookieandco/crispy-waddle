import type { LearningCandidate } from './prediction-learning.js';
import type { ValidatedLearningRecord } from './validated-learning-store.js';

export interface LearningSafetyAudit {
  passed: boolean;
  failures: readonly string[];
}

export function auditLearningCandidate(candidate: LearningCandidate): LearningSafetyAudit {
  const failures: string[] = [];
  if (!candidate.predictionId.trim() || !candidate.gameId.trim()) failures.push('missing prediction/game identity');
  if (candidate.evidenceIds.length === 0) failures.push('missing evidence lineage');
  if (!candidate.modelVersion.trim() || !candidate.calibrationVersion.trim() || !candidate.featureSetVersion.trim()) failures.push('missing model lineage');
  if (Math.abs(candidate.boundedDelta) > 0.05 && candidate.target !== 'MODEL_CHALLENGER') failures.push('unbounded learning delta');
  if (candidate.target === 'MODEL_CHALLENGER' && candidate.boundedDelta !== 0) failures.push('model challenger cannot directly mutate parameters');
  return Object.freeze({ passed: failures.length === 0, failures: Object.freeze(failures) });
}

export function auditValidatedLearning(record: ValidatedLearningRecord): LearningSafetyAudit {
  const base = auditLearningCandidate(record);
  const failures = [...base.failures];
  if (record.disposition === 'VALIDATED' && record.supportingValidationIds.length < 2) failures.push('validated learning lacks repeated support');
  if (record.disposition === 'VALIDATED' && !record.realityStateHash) failures.push('validated learning lacks reality-state hash');
  return Object.freeze({ passed: failures.length === 0, failures: Object.freeze(failures) });
}

export function assertNoDirectFinancialExecutionPath(moduleDependencies: readonly string[]): void {
  const forbidden = moduleDependencies.filter((item) => /money[-_ ]?core|broker|sportsbook|wager|execution/i.test(item));
  if (forbidden.length > 0) throw new Error(`Sports learning must not depend on financial execution modules: ${forbidden.join(', ')}`);
}
