import type { LearningCandidate } from './learning-content.js';

export type LearningDecision = {
  accept: boolean;
  reason: string;
};

export type LearningEvidence = {
  candidate: LearningCandidate;
  corroboratingObservationIds?: string[];
};

export function evaluateLearningEvidence(input: LearningEvidence): LearningDecision {
  const confidence = input.candidate.confidence ?? 0;
  const corroboration = input.corroboratingObservationIds?.length ?? 0;
  if (confidence < 0.7) return { accept: false, reason: 'confidence-below-learning-threshold' };
  if (corroboration === 0) return { accept: true, reason: 'candidate-kept-with-single-source-provenance' };
  return { accept: true, reason: 'candidate-corroborated' };
}
