const { buildIdentityPacket } = require('./identity-packet');
const { summarizeContactEvidence } = require('./contact-evidence');
const { runIdentityDiscovery } = require('./runner');
const { verifyIdentity } = require('./verification');

async function buildWashoeIdentityBatchReport(records, providersForRecord) {
  const rows = [];

  for (const record of records) {
    const discovery = await runIdentityDiscovery({
      candidate: record.candidate,
      providers: providersForRecord(record),
    });

    const packet = buildIdentityPacket({
      ...record,
      discovery,
      contacts: record.contacts || [],
      relatedContacts: record.relatedContacts || [],
    });

    const contactSummary = summarizeContactEvidence(record.contacts || []);
    const verification = verifyIdentity({
      candidate: discovery,
      entitlementEvidence: record.entitlementEvidence || [],
      outreachPolicy: record.outreachPolicy || { allowed: false },
    });

    rows.push({
      recordId: record.recordId || record.candidate?.candidateId || null,
      parcelId: packet.parcelEvidence.parcelId,
      parcelMatch: packet.parcelEvidence.parcelMatch,
      candidateParcelMatch: packet.parcelEvidence.candidateParcelMatch,
      identityConfidence: verification.identityConfidence,
      evidenceSourceCount: packet.evidence.length,
      contactCount: contactSummary.contacts.length,
      highestContactConfidence: contactSummary.highestConfidence,
      verifiedContactOwnershipCount: contactSummary.verifiedOwnershipCount,
      verificationDecision: verification.verificationDecision,
      entitlementVerified: verification.entitlementVerified,
      outreachDecision: verification.outreachDecision,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows,
    invariants: {
      parcelEvidencePresent: rows.every((r) => Boolean(r.parcelId)),
      noUnverifiedEntitlement: rows.every((r) =>
        r.entitlementVerified === true ? r.verificationDecision === 'VERIFIED' : true
      ),
      noImplicitOutreach: rows.every((r) =>
        r.verificationDecision !== 'VERIFIED' ? r.outreachDecision === 'BLOCKED' : true
      ),
    },
  };
}

module.exports = { buildWashoeIdentityBatchReport };
