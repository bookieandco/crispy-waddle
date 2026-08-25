const { buildIdentityPacket } = require('./identity-packet');
const { verifyIdentity } = require('./verification');

/**
 * Controlled Washoe fixture. It proves the complete evidence boundary without
 * contacting a person or asserting entitlement from a name/parcel match.
 */
function buildControlledWashoePacket() {
  const candidate = {
    candidateId: 'washoe-controlled-001',
    name: 'CONTROLLED TEST SUBJECT',
    username: 'controlled-public-handle',
    parcelId: '123-45-678',
    propertyAddress: 'CONTROLLED TEST ADDRESS',
  };

  const discovery = {
    identityConfidence: 86,
    evidence: [
      { source: 'washoe-treasury-fixture', sourceClass: 'OFFICIAL_GOVERNMENT', sourceRecordId: 'W-001', observedIdentifiers: ['12345678'], reliability: 1 },
      { source: 'washoe-assessor-fixture', sourceClass: 'OFFICIAL_GOVERNMENT', sourceRecordId: 'A-001', observedIdentifiers: ['12345678'], reliability: 1 },
      { source: 'sherlock-fixture', sourceClass: 'PUBLIC_SOCIAL', sourceRecordId: 'S-001', observedIdentifiers: ['controlled-public-handle'], reliability: 0.8 },
      { source: 'maigret-fixture', sourceClass: 'PUBLIC_SOCIAL', sourceRecordId: 'M-001', observedIdentifiers: ['controlled-public-handle'], reliability: 0.8 },
    ],
    conflicts: [],
  };

  return buildIdentityPacket({
    candidate,
    discovery,
    treasury: { parcelId: '123-45-678' },
    assessor: { parcelId: '12345678' },
  });
}

function verifyControlledWashoePacket() {
  const packet = buildControlledWashoePacket();
  const result = verifyIdentity({
    candidate: {
      evidence: packet.evidence,
      contacts: packet.contacts,
      conflicts: packet.conflicts,
    },
    entitlementEvidence: [],
    outreachPolicy: { commercialSolicitationRequiresHumanReview: true },
  });

  if (!packet.parcelEvidence.parcelMatch || !packet.parcelEvidence.candidateParcelMatch) {
    throw new Error('Washoe controlled fixture must corroborate the parcel');
  }
  if (result.verificationDecision !== 'REVIEW_REQUIRED') {
    throw new Error('Identity evidence must not establish entitlement');
  }
  if (result.outreachDecision !== 'BLOCKED') {
    throw new Error('Unverified claimant outreach must remain blocked');
  }

  return { packet, verification: result };
}

module.exports = { buildControlledWashoePacket, verifyControlledWashoePacket };
