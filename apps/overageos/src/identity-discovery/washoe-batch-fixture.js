const { buildIdentityPacket } = require('./identity-packet');
const { runIdentityDiscovery } = require('./runner');
const { verifyIdentity } = require('./verification');

function makeRecord(index) {
  const parcelId = `WASHOE-${String(index).padStart(4, '0')}`;
  return {
    candidate: {
      candidateId: `washoe-fixture-${index}`,
      name: `Controlled Candidate ${index}`,
      username: `controlled-public-handle-${index}`,
      parcelId,
      propertyAddress: `${100 + index} Controlled Ave`,
    },
    treasury: { parcelId },
    assessor: { parcelId },
  };
}

function fixtureProvider(name, index) {
  return {
    name,
    sourceClass: 'PUBLIC_SOCIAL',
    async discover() {
      return [{
        id: `${name}-${index}`,
        url: `https://example.invalid/${name}/${index}`,
        platform: 'controlled-fixture',
        reliability: 0.75,
      }];
    },
  };
}

async function runWashoeBatchFixture(count = 10) {
  const results = [];
  for (let index = 1; index <= count; index += 1) {
    const record = makeRecord(index);
    const discovery = await runIdentityDiscovery({
      candidate: record.candidate,
      providers: [
        fixtureProvider('sherlock-fixture', index),
        fixtureProvider('maigret-fixture', index),
        fixtureProvider('third-source-fixture', index),
      ],
    });

    const packet = buildIdentityPacket({
      ...record,
      discovery,
    });

    const verification = verifyIdentity({
      candidate: discovery,
      entitlementEvidence: [],
      outreachPolicy: { commercialSolicitationRequiresHumanReview: true },
    });

    results.push({
      record: index,
      parcelMatch: packet.parcelEvidence.parcelMatch,
      candidateParcelMatch: packet.parcelEvidence.candidateParcelMatch,
      identityConfidence: verification.identityConfidence,
      verificationDecision: verification.verificationDecision,
      outreachDecision: verification.outreachDecision,
    });
  }

  return {
    count: results.length,
    results,
    invariants: {
      allParcelMatches: results.every((r) => r.parcelMatch && r.candidateParcelMatch),
      allRequireReview: results.every((r) => r.verificationDecision === 'REVIEW_REQUIRED'),
      allOutreachBlocked: results.every((r) => r.outreachDecision === 'BLOCKED'),
    },
  };
}

module.exports = { runWashoeBatchFixture };
