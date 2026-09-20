import type { LearningCandidate } from './prediction-learning.js';
import type { PlayerAttributeEvidence } from './player-attributes.js';
import type { ValidatedLearningRecord } from './validated-learning-store.js';

export interface PlayerStateLearningContext {
  playerId: string;
  eventId: string;
  attribute: string;
  currentValue: number;
  observedAt: string;
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function playerStateEvidenceFromLearning(
  record: ValidatedLearningRecord,
  context: PlayerStateLearningContext,
): PlayerAttributeEvidence {
  if (record.target !== 'PLAYER_STATE' || record.disposition !== 'VALIDATED') throw new Error('Player-state learning requires a validated PLAYER_STATE record');
  if (!record.realityStateHash) throw new Error('Player-state learning requires canonical reality-state lineage');
  const value = clamp(context.currentValue + record.boundedDelta * 100);
  return Object.freeze({
    evidenceId: `learning:${record.candidateId}:${context.playerId}:${context.attribute}`,
    eventId: context.eventId,
    playerId: context.playerId,
    attribute: context.attribute,
    value,
    weight: Math.max(0.1, Math.min(1, record.attributionConfidence)),
    observedAt: context.observedAt,
    context: Object.freeze({ candidateId: record.candidateId, realityStateHash: record.realityStateHash }),
    provenance: 'MODEL_ASSISTED',
  });
}

export function isPlayerStateLearningCandidate(candidate: LearningCandidate): boolean {
  return candidate.target === 'PLAYER_STATE' && candidate.disposition === 'PROPOSED';
}
