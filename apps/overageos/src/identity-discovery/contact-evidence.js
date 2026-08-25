/**
 * Safe contact-evidence layer. Stores provenance and confidence without
 * asserting that a discovered contact belongs to the legal claimant.
 */

const CONTACT_TYPES = new Set(['official', 'business', 'public_profile', 'user_provided']);

function normalizeContactEvidence(input) {
  if (!input || !CONTACT_TYPES.has(input.type) || !input.value) {
    throw new Error('Contact evidence requires a supported type and value');
  }

  return {
    type: input.type,
    value: String(input.value).trim(),
    source: input.source || null,
    sourceUrl: input.sourceUrl || null,
    observedAt: input.observedAt || null,
    confidence: Number.isFinite(input.confidence) ? Math.max(0, Math.min(100, Math.round(input.confidence))) : 0,
    corroborationCount: Number.isFinite(input.corroborationCount) ? input.corroborationCount : 0,
    ownershipStatus: input.ownershipStatus || 'UNCONFIRMED',
    outreachStatus: 'NOT_AUTHORIZED',
  };
}

function summarizeContactEvidence(contacts) {
  const normalized = contacts.map(normalizeContactEvidence);
  return {
    contacts: normalized,
    highestConfidence: normalized.length ? Math.max(...normalized.map((c) => c.confidence)) : 0,
    verifiedOwnershipCount: normalized.filter((c) => c.ownershipStatus === 'VERIFIED').length,
  };
}

module.exports = { normalizeContactEvidence, summarizeContactEvidence };
