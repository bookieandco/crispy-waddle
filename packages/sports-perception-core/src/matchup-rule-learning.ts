import type { Sport } from './contracts.js';
import type { PlayerMatchupRule } from './player-matchup-rules.js';
import type { ValidatedLearningRecord } from './validated-learning-store.js';

export interface LearnedMatchupRule extends PlayerMatchupRule {
  baseWeight: number;
  learnedWeight: number;
  learningCandidateIds: readonly string[];
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function applyValidatedMatchupLearning(
  sport: Sport,
  rule: PlayerMatchupRule,
  records: readonly ValidatedLearningRecord[],
): LearnedMatchupRule {
  const applicable = records.filter((record) => record.target === 'MATCHUP_RULE' && record.disposition === 'VALIDATED');
  const delta = applicable.reduce((sum, record) => sum + record.boundedDelta, 0);
  return Object.freeze({
    ...rule,
    sport,
    baseWeight: rule.weight,
    learnedWeight: clamp(rule.weight + delta),
    weight: clamp(rule.weight + delta),
    learningCandidateIds: Object.freeze(applicable.map((record) => record.candidateId).sort()),
  });
}
