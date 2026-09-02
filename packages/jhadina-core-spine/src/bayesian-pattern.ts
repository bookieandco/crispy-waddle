import type { PatternObservation } from './types.js';
import { createBetaPrior, updateBetaBelief } from './bayesian-inference.js';

export interface BayesianPatternEvidence {
  /** Support for the observed pattern, bounded to [0, 1]. */
  support: number;
  /** Evidence weight before source reliability is applied. */
  weight: number;
  /** Optional reliability of the evidence source, bounded to [0, 1]. */
  reliability?: number;
}

export interface BayesianPatternAssessment {
  patternId: string;
  priorAlpha: number;
  priorBeta: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  confidence: number;
  uncertainty: number;
  lowerBound: number;
  upperBound: number;
  evidenceCount: number;
  /** Bayesian confidence is an estimate, not a personality mutation decision. */
  eligibleForPersonality: boolean;
}

/**
 * Converts a PatternObservation into a bounded Bayesian belief assessment.
 *
 * This function intentionally does not mutate the PatternObservation or
 * PersonalityState. Personality eligibility remains an explicit domain gate.
 */
export function assessPatternBayesian(
  pattern: PatternObservation,
  evidence: BayesianPatternEvidence[],
  prior = createBetaPrior(1, 1),
): BayesianPatternAssessment {
  if (!pattern.id.trim()) throw new RangeError('pattern.id must not be empty');
  if (!Number.isInteger(pattern.occurrences) || pattern.occurrences <= 0) {
    throw new RangeError('pattern.occurrences must be a positive integer');
  }

  const posterior = updateBetaBelief(prior, evidence);
  const evidenceCount = evidence.filter((item) => item.weight > 0 && (item.reliability ?? 1) > 0).length;

  return {
    patternId: pattern.id,
    priorAlpha: prior.alpha,
    priorBeta: prior.beta,
    posteriorAlpha: posterior.alpha,
    posteriorBeta: posterior.beta,
    confidence: posterior.mean,
    uncertainty: posterior.uncertainty,
    lowerBound: posterior.lowerBound,
    upperBound: posterior.upperBound,
    evidenceCount,
    eligibleForPersonality: Boolean(pattern.personalityEligible && pattern.personalityDimension),
  };
}
