const { runIdentityDiscovery } = require('./runner');
const { verifyIdentity } = require('./verification');

function fixtureProvider(name, observations) {
  return {
    name,
    sourceClass: 'PUBLIC_SOCIAL',
    async discover() {
      return observations;
    },
  };
}

async function runControlledIdentityVerificationTest() {
  const candidate = {
    candidateId: 'washoe-controlled-001',
    username: 'controlled-public-handle',
  };

  const providers = [
    fixtureProvider('sherlock-fixture', [{ id: 's1', url: 'https://example.invalid/sherlock', platform: 'fixture', reliability: 0.8 }]),
    fixtureProvider('maigret-fixture', [{ id: 'm1', url: 'https://example.invalid/maigret', platform: 'fixture', reliability: 0.8 }]),
    fixtureProvider('social-analyzer-fixture', [{ id: 'a1', url: 'https://example.invalid/social-analyzer', platform: 'fixture', reliability: 0.7 }]),
  ];

  const discovery = await runIdentityDiscovery({ candidate, providers });
  const verification = verifyIdentity({
    candidate: discovery,
    entitlementEvidence: [],
    outreachPolicy: { commercialSolicitationRequiresHumanReview: true },
  });

  if (verification.verificationDecision !== 'REVIEW_REQUIRED') {
    throw new Error('Controlled identity test must not verify entitlement without entitlement evidence');
  }
  if (verification.outreachDecision !== 'BLOCKED') {
    throw new Error('Controlled identity test must block outreach');
  }

  return {
    identityConfidence: verification.identityConfidence,
    verificationDecision: verification.verificationDecision,
    outreachDecision: verification.outreachDecision,
    providers: providers.map((p) => p.name),
    liveProviderData: verification.liveProviderData,
  };
}

module.exports = { runControlledIdentityVerificationTest };
