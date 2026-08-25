const { normalizeEvidence, normalizeContact } = require('./types');

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Deterministic identity-evidence scoring.
 * This is confidence in the evidence supporting a candidate, not legal entitlement.
 */
function scoreCandidate({ evidence = [], contacts = [], conflicts = [] }) {
  const normalizedEvidence = evidence.map(normalizeEvidence);
  const normalizedContacts = contacts.map(normalizeContact);

  const uniqueSources = new Set(normalizedEvidence.map((e) => `${e.sourceClass}:${e.source}`));
  const authoritative = normalizedEvidence.filter((e) =>
    e.sourceClass === 'OFFICIAL_GOVERNMENT' || e.sourceClass === 'PUBLIC_RECORD'
  ).length;
  const corroborating = normalizedEvidence.filter((e) =>
    e.sourceClass === 'AUTHORIZED_PROVIDER' || e.sourceClass === 'PUBLIC_WEB' || e.sourceClass === 'PUBLIC_SOCIAL'
  ).length;

  let score = 0;
  score += Math.min(45, authoritative * 15);
  score += Math.min(30, corroborating * 7);
  score += Math.min(15, Math.max(0, uniqueSources.size - 1) * 5);
  score += Math.min(10, normalizedContacts.filter((c) => c.corroborationCount > 0).length * 3);
  score -= Math.min(30, conflicts.length * 10);

  return {
    identityConfidence: clamp(score),
    evidence: normalizedEvidence,
    contacts: normalizedContacts,
    conflicts,
    independentSourceCount: uniqueSources.size,
    authoritativeEvidenceCount: authoritative,
    corroboratingEvidenceCount: corroborating,
  };
}

function resolveCandidate(input) {
  const scored = scoreCandidate(input);
  let state = 'CANDIDATE';
  if (scored.conflicts.length > 0 || scored.identityConfidence < 70) state = 'REVIEW_REQUIRED';
  return { ...scored, state };
}

module.exports = { scoreCandidate, resolveCandidate };
