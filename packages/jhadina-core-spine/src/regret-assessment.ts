import type { EvidenceRef } from './types.js';
import type { RegretAvoidability, RegretSeverity, RegretSubjectType } from './regret.js';

export type RegretAssessmentDisposition = 'regret' | 'no_regret' | 'insufficient_evidence';

export interface RegretAssessmentInput {
  readonly subjectType: RegretSubjectType;
  readonly subjectId: string;
  readonly originalBelief: string;
  readonly expectedOutcome: string;
  readonly actualOutcome: string;
  readonly outcomeEvidence: readonly EvidenceRef[];
  readonly discrepancy: string;
  readonly severity: RegretSeverity;
  readonly avoidability: RegretAvoidability;
  readonly couldHaveKnown: boolean | null;
  readonly couldHaveActedDifferently: boolean | null;
  readonly alternativeLikelyImprovedOutcome: boolean | null;
  readonly rootCause?: string;
}

export interface RegretAssessment {
  readonly disposition: RegretAssessmentDisposition;
  readonly reason: string;
  readonly evidence: readonly EvidenceRef[];
  readonly preventable: boolean;
  readonly learningWarranted: boolean;
}

export function assessRegret(input: RegretAssessmentInput): RegretAssessment {
  if (input.outcomeEvidence.length === 0) {
    return Object.freeze({ disposition: 'insufficient_evidence', reason: 'No verified outcome evidence.', evidence: Object.freeze([]), preventable: false, learningWarranted: false });
  }

  const known = input.couldHaveKnown === true;
  const different = input.couldHaveActedDifferently === true;
  const better = input.alternativeLikelyImprovedOutcome === true;
  const preventable = known && different && better;

  if (input.avoidability === 'unknown' || input.couldHaveKnown === null || input.couldHaveActedDifferently === null || input.alternativeLikelyImprovedOutcome === null) {
    return Object.freeze({ disposition: 'insufficient_evidence', reason: 'Counterfactual preventability is not sufficiently established.', evidence: Object.freeze([...input.outcomeEvidence]), preventable: false, learningWarranted: false });
  }

  if (!preventable) {
    return Object.freeze({ disposition: 'no_regret', reason: 'The verified evidence does not establish a preventable failure.', evidence: Object.freeze([...input.outcomeEvidence]), preventable: false, learningWarranted: false });
  }

  return Object.freeze({ disposition: 'regret', reason: 'Verified evidence supports a preventable failure: the relevant information was knowable, an alternative action was available, and it was likely to improve the outcome.', evidence: Object.freeze([...input.outcomeEvidence]), preventable: true, learningWarranted: true });
}
