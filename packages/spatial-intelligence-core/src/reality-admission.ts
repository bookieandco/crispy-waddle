import type { SpatialRealityCandidate, RealityAdmissionDecision } from './reality.js';

export type SpatialRealityAdmissionInput = {
  candidate: SpatialRealityCandidate;
  verifier: string;
  evidenceAvailable: ReadonlySet<string>;
  /** Evidence refs whose provenance is synthetic, fallback, or otherwise non-CCTV fallback supply. */
  fallbackEvidenceRefs?: ReadonlySet<string>;
  /** Minimum number of available non-fallback evidence refs required for admission. Defaults to one. */
  requiredNonFallbackEvidence?: number;
  acceptDeterminations?: ReadonlySet<SpatialRealityCandidate['determination']>;
  createdAt: string;
};
export type SpatialRealityAdmissionResult = { decision: RealityAdmissionDecision; rationale: string[]; evidenceRefs: string[] };

/**
 * Deterministic admission gate; it never promotes a candidate implicitly.
 *
 * Fallback/synthetic evidence can remain valid evidence for observation and
 * analysis, but cannot by itself establish canonical spatial reality.
 */
export function evaluateSpatialRealityAdmission(input: SpatialRealityAdmissionInput): SpatialRealityAdmissionResult {
  const accepted = input.acceptDeterminations ?? new Set<SpatialRealityCandidate['determination']>(['observed', 'corroborated', 'verified']);
  const fallbackRefs = input.fallbackEvidenceRefs ?? new Set<string>();
  const requiredNonFallbackEvidence = input.requiredNonFallbackEvidence ?? 1;
  const availableEvidence = input.candidate.evidenceRefs.filter((ref) => input.evidenceAvailable.has(ref));
  const missingEvidence = input.candidate.evidenceRefs.filter((ref) => !input.evidenceAvailable.has(ref));
  const availableNonFallbackEvidence = availableEvidence.filter((ref) => !fallbackRefs.has(ref));

  if (!input.verifier) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: ['SPATIAL_REALITY_VERIFIER_REQUIRED'] };
  if (!input.createdAt) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: ['SPATIAL_REALITY_ADMISSION_CREATED_AT_REQUIRED'] };
  if (missingEvidence.length) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: [`Missing evidence refs: ${missingEvidence.join(', ')}`] };
  if (!accepted.has(input.candidate.determination)) return { decision: 'DEFER', evidenceRefs: availableEvidence, rationale: [`Determination ${input.candidate.determination} is not admissible under this policy.`] };
  if (!availableEvidence.length) return { decision: 'DEFER', evidenceRefs: [], rationale: ['No evidence is available for admission.'] };
  if (requiredNonFallbackEvidence > 0 && availableNonFallbackEvidence.length < requiredNonFallbackEvidence) {
    return {
      decision: 'DEFER',
      evidenceRefs: availableEvidence,
      rationale: ['SPATIAL_REALITY_NON_FALLBACK_EVIDENCE_REQUIRED', `Required ${requiredNonFallbackEvidence} non-fallback evidence ref(s); found ${availableNonFallbackEvidence.length}.`],
    };
  }
  return { decision: 'ACCEPT', evidenceRefs: availableEvidence, rationale: ['Candidate has the required evidence references, an admissible determination, and sufficient non-fallback evidence.'] };
}
