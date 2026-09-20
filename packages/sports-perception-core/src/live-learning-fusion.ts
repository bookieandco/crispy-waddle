import type { LiveGameObservation } from './live-game-watcher.js';
import type { LearningCandidate } from './prediction-learning.js';

export interface LiveLearningEvidence {
  evidenceId: string;
  gameId: string;
  observationId: string;
  candidateId: string;
  observedAt: string;
  confidence: number;
}

export function fuseLiveObservationWithCandidate(
  observation: LiveGameObservation,
  candidate: LearningCandidate,
): LiveLearningEvidence | undefined {
  if (candidate.gameId !== observation.gameId || candidate.disposition !== 'PROPOSED') return undefined;
  if (observation.classification === 'HYPOTHESIS') return undefined;
  return Object.freeze({
    evidenceId: `live-learning:${observation.observationId}:${candidate.candidateId}`,
    gameId: observation.gameId,
    observationId: observation.observationId,
    candidateId: candidate.candidateId,
    observedAt: observation.observedAt,
    confidence: Math.min(candidate.attributionConfidence, observation.confidence),
  });
}
