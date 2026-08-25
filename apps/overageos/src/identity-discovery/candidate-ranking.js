/**
 * Rank identity candidates from independent evidence observations.
 * This is probabilistic corroboration only; it never establishes legal entitlement.
 */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scoreCandidate({ candidate, parcelEvidence, observations = [], conflicts = [] }) {
  const scores = [];
  const reasons = [];

  if (parcelEvidence?.parcelMatch) {
    scores.push(35);
    reasons.push('treasury_assessor_parcel_match');
  }
  if (parcelEvidence?.candidateParcelMatch) {
    scores.push(15);
    reasons.push('candidate_parcel_match');
  }

  const uniqueSources = new Set(observations.map((o) => o.source || o.provider).filter(Boolean));
  const sourceBonus = Math.min(25, uniqueSources.size * 8);
  if (sourceBonus) {
    scores.push(sourceBonus);
    reasons.push(`independent_sources:${uniqueSources.size}`);
  }

  const candidateName = normalize(candidate?.name);
  const matchingNames = observations.filter((o) => candidateName && normalize(o.name) === candidateName).length;
  if (matchingNames) {
    scores.push(Math.min(15, matchingNames * 5));
    reasons.push(`name_corroboration:${matchingNames}`);
  }

  const conflictPenalty = Math.min(30, conflicts.length * 10);
  if (conflictPenalty) reasons.push(`conflicts:${conflicts.length}`);

  const confidence = clamp(Math.round(scores.reduce((a, b) => a + b, 0) - conflictPenalty));

  return {
    candidateId: candidate?.candidateId || null,
    confidence,
    reasons,
    conflictCount: conflicts.length,
    sourceCount: uniqueSources.size,
    verificationDecision: 'REVIEW_REQUIRED',
  };
}

function rankCandidates(input) {
  return (input.candidates || [])
    .map((candidate) => scoreCandidate({
      candidate,
      parcelEvidence: input.parcelEvidenceByCandidate?.[candidate.candidateId],
      observations: input.observationsByCandidate?.[candidate.candidateId] || [],
      conflicts: input.conflictsByCandidate?.[candidate.candidateId] || [],
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

module.exports = { scoreCandidate, rankCandidates };
