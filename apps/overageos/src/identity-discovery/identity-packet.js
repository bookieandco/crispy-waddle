const { normalizeContact } = require('./types');
const { buildParcelEvidence } = require('./parcel-corroboration');

function buildIdentityPacket({ candidate, discovery, treasury, assessor, contacts = [], relatedContacts = [] }) {
  const parcel = buildParcelEvidence({ treasury, assessor, candidate });
  const normalizedContacts = contacts.map(normalizeContact);

  return {
    candidate: {
      candidateId: candidate?.candidateId || null,
      name: candidate?.name || null,
      username: candidate?.username || null,
      parcelId: parcel.parcelId,
      propertyAddress: candidate?.propertyAddress || null,
    },
    identityConfidence: discovery?.identityConfidence ?? 0,
    evidence: discovery?.evidence || [],
    parcelEvidence: parcel,
    contacts: normalizedContacts,
    relatedContacts: relatedContacts.map((contact) => ({
      ...contact,
      confidence: Number.isFinite(contact.confidence) ? contact.confidence : 0,
      reviewRequired: true,
    })),
    conflicts: discovery?.conflicts || [],
    verification: {
      identityDecision: 'NOT_DETERMINED',
      entitlementDecision: 'NOT_DETERMINED',
      outreachDecision: 'BLOCKED',
      humanReviewRequired: true,
    },
  };
}

module.exports = { buildIdentityPacket };
