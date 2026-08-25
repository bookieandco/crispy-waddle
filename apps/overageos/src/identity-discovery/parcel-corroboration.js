/**
 * Parcel-aware corroboration for OverageOS.
 * A parcel is an evidence key that links records; it is never treated as
 * proof that a discovered person is the legal claimant.
 */

function normalizeParcelId(value) {
  if (value == null) return null;
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildParcelEvidence({ treasury, assessor, candidate }) {
  const treasuryParcel = normalizeParcelId(treasury?.parcelId);
  const assessorParcel = normalizeParcelId(assessor?.parcelId);
  const candidateParcel = normalizeParcelId(candidate?.parcelId);

  const parcelMatch = Boolean(
    treasuryParcel && assessorParcel && treasuryParcel === assessorParcel
  );

  const candidateMatches = Boolean(
    candidateParcel && treasuryParcel && candidateParcel === treasuryParcel
  );

  return {
    parcelId: candidateParcel || treasuryParcel || assessorParcel || null,
    parcelMatch,
    candidateParcelMatch: candidateMatches,
    evidenceClass: parcelMatch ? 'PARCEL_CORROBORATED' : 'PARCEL_UNCORROBORATED',
    identityDecision: 'NOT_DETERMINED',
    requiresHumanVerification: true,
  };
}

module.exports = { normalizeParcelId, buildParcelEvidence };
