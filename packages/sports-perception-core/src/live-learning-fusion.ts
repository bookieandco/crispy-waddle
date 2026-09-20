import type { GameNote } from './live-game-watcher.js';
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
  observation: GameNote,
  candidate: LearningCandidate,
): LiveLearningEvidence | undefined {
  if (candidate.gameId !== observation.eventId || candidate.disposition !== 'PROPOSED') return undefined;
  if (observation.type === 'HYPOTHESIS' || observation.type === 'INFERENCE') return undefined;
  return Object.freeze({
    evidenceId: `live-learning:${observation.noteId}:${candidate.candidateId}`,
    gameId: observation.eventId,
    observationId: observation.noteId,
    candidateId: candidate.candidateId,
    observedAt: observation.observedAt,
    confidence: Math.min(candidate.attributionConfidence, observation.confidence),
  });
}
