import type { SpatialRealityCandidate, RealityAdmission, RealityAdmissionDecision } from './reality.js';

export type SpatialRealityAdmissionInput = {
  candidate: SpatialRealityCandidate;
  verifier: string;
  evidenceAvailable: Set<string>;
  acceptDeterminations?: ReadonlySet<SpatialRealityCandidate['determination']>;
  createdAt: string;
};

export type SpatialRealityAdmissionResult = {
  decision: RealityAdmissionDecision;
  rationale: string[];
  evidenceRefs: string[];
};

/**
 * Deterministic admission gate. It evaluates evidence sufficiency but never
 * invents evidence or treats predictions/LLM output as reality.
 */
export function evaluateSpatialRealityAdmission(input: SpatialRealityAdmissionInput): SpatialRealityAdmissionResult {
  const accepted = input.acceptDeterminations ?? new Set<SpatialRealityCandidate['determination']>(['observed', 'corroborated', 'verified']);
  const availableEvidence = input.candidate.evidenceRefs.filter((ref) => input.evidenceAvailable.has(ref));
  const missingEvidence = input.candidate.evidenceRefs.filter((ref) => !input.evidenceAvailable.has(ref));
  const rationale: string[] = [];

  if (!input.verifier) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: ['SPATIAL_REALITY_VERIFIER_REQUIRED'] };
  if (missingEvidence.length) {
    rationale.push(`Missing evidence refs: ${missingEvidence.join(', ')}`);
    return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale };
  }
  if (!accepted.has(input.candidate.determination)) {
    rationale.push(`Determination ${input.candidate.determination} is not admissible under this policy.`);
    return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale };
  }
  if (!availableEvidence.length) {
    rationale.push('No evidence is available for admission.');
    return { decision: 'DEFER', evidenceRefs: [], rationale };
  }

  rationale.push('Candidate has the required evidence references and an admissible determination.');
  return { decision: 'ACCEPT', evidenceRefs: availableEvidence, rationale };
}
