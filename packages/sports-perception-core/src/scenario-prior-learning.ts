import type { ScenarioEvaluation } from './adaptive-scenario-search.js';
import type { ValidatedLearningRecord } from './validated-learning-store.js';

export interface ScenarioPrior {
  scenarioFingerprint: string;
  prior: number;
  evidenceCount: number;
  candidateIds: readonly string[];
}

export function updateScenarioPrior(
  current: ScenarioPrior,
  evaluation: ScenarioEvaluation,
  records: readonly ValidatedLearningRecord[],
): ScenarioPrior {
  const validated = records.filter((record) => record.target === 'SCENARIO_PRIOR' && record.disposition === 'VALIDATED');
  if (validated.length === 0) return current;
  const fitnessSignal = Math.tanh(evaluation.fitness);
  const delta = validated.reduce((sum, record) => sum + record.boundedDelta, 0) * fitnessSignal;
  return Object.freeze({
    scenarioFingerprint: current.scenarioFingerprint,
    prior: Math.max(0.01, Math.min(0.99, current.prior + delta)),
    evidenceCount: current.evidenceCount + validated.length,
    candidateIds: Object.freeze([...new Set([...current.candidateIds, ...validated.map((record) => record.candidateId)])].sort()),
  });
}
