import type { SpatialRealityCandidate, RealityAdmissionDecision } from './reality.js';

export type SpatialRealityAdmissionInput = {
  candidate: SpatialRealityCandidate;
  verifier: string;
  evidenceAvailable: ReadonlySet<string>;
  acceptDeterminations?: ReadonlySet<SpatialRealityCandidate['determination']>;
  createdAt: string;
};
export type SpatialRealityAdmissionResult = { decision: RealityAdmissionDecision; rationale: string[]; evidenceRefs: string[] };

/** Deterministic admission gate; it never promotes a candidate implicitly. */
export function evaluateSpatialRealityAdmission(input: SpatialRealityAdmissionInput): SpatialRealityAdmissionResult {
  const accepted = input.acceptDeterminations ?? new Set<SpatialRealityCandidate['determination']>(['observed', 'corroborated', 'verified']);
  const availableEvidence = input.candidate.evidenceRefs.filter((ref) => input.evidenceAvailable.has(ref));
  const missingEvidence = input.candidate.evidenceRefs.filter((ref) => !input.evidenceAvailable.has(ref));
  if (!input.verifier) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: ['SPATIAL_REALITY_VERIFIER_REQUIRED'] };
  if (!input.createdAt) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: ['SPATIAL_REALITY_ADMISSION_CREATED_AT_REQUIRED'] };
  if (missingEvidence.length) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: [`Missing evidence refs: ${missingEvidence.join(', ')}`] };
  if (!accepted.has(input.candidate.determination)) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: [`Determination ${input.candidate.determination} is not admissible under this policy.`] };
  if (!availableEvidence.length) return { decision: 'DEFER', evidenceRefs: [], rationale: ['No evidence is available for admission.'] };
  return { decision: 'ACCEPT', evidenceRefs: availableEvidence, rationale: ['Candidate has the required evidence references and an admissible determination.'] };
}
