const { resolveCandidate } = require('./corroboration');

/**
 * Identity verification gate. A high identity score alone can never establish
 * entitlement or authorize outreach.
 */
function verifyIdentity({ candidate, entitlementEvidence = [], outreachPolicy = {} }) {
  const resolved = resolveCandidate(candidate);

  if (resolved.state !== 'CANDIDATE' || resolved.identityConfidence < 70) {
    return {
      ...resolved,
      verificationDecision: 'REVIEW_REQUIRED',
      entitlementVerified: false,
      outreachDecision: 'BLOCKED',
    };
  }

  const entitlementVerified = entitlementEvidence.length > 0 &&
    entitlementEvidence.every((item) => item && item.supportsEntitlement === true);

  if (!entitlementVerified) {
    return {
      ...resolved,
      verificationDecision: 'REVIEW_REQUIRED',
      entitlementVerified: false,
      outreachDecision: 'BLOCKED',
    };
  }

  const outreachDecision = outreachPolicy.commercialSolicitationRequiresHumanReview
    ? 'RESTRICTED'
    : outreachPolicy.allowed === true
      ? 'PERMITTED'
      : 'BLOCKED';

  return {
    ...resolved,
    state: 'VERIFIED',
    verificationDecision: 'VERIFIED',
    entitlementVerified: true,
    outreachDecision,
  };
}

module.exports = { verifyIdentity };
