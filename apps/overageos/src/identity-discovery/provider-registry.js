/**
 * External identity/skip-trace provider registry.
 * Providers are adapters, not entitlement authorities.
 *
 * We intentionally keep upstream repositories external rather than copying
 * their code into OverageOS. Each adapter must normalize observations into
 * the common evidence shape and respect the source's license/terms.
 */

const PROVIDERS = Object.freeze([
  {
    id: 'webolivia-skip-trace',
    kind: 'skip_trace',
    repository: 'WebOlivia/skip-trace',
    url: 'https://github.com/WebOlivia/skip-trace',
    status: 'ADAPTER_PENDING',
    inputs: ['name', 'address', 'phone'],
    outputs: ['identity_observations', 'contact_evidence'],
  },
  {
    id: 'gautavaid-skip-tracing',
    kind: 'skip_trace_orchestration',
    repository: 'GautaVaid/Skip_Tracing',
    url: 'https://github.com/GautaVaid/Skip_Tracing',
    status: 'ADAPTER_PENDING',
    inputs: ['name', 'address', 'phone'],
    outputs: ['identity_observations', 'provider_metadata'],
  },
  {
    id: 'apivault-people-finder',
    kind: 'skip_trace_api',
    repository: 'apivault-labs/skip-trace-people-finder-python',
    url: 'https://github.com/apivault-labs/skip-trace-people-finder-python',
    status: 'ADAPTER_PENDING',
    inputs: ['name', 'address', 'phone'],
    outputs: ['identity_observations', 'contact_evidence'],
    usagePolicy: 'LAWFUL_B2B_ONLY',
  },
  {
    id: 'sherlock',
    kind: 'public_username_discovery',
    repository: 'sherlock-project/sherlock',
    url: 'https://github.com/sherlock-project/sherlock',
    status: 'ADAPTER_PENDING',
    inputs: ['explicit_public_username'],
    outputs: ['public_profile_observations'],
  },
  {
    id: 'maigret',
    kind: 'public_username_discovery',
    repository: 'soxoj/maigret',
    url: 'https://github.com/soxoj/maigret',
    status: 'ADAPTER_PENDING',
    inputs: ['explicit_public_username'],
    outputs: ['public_profile_observations'],
  },
  {
    id: 'social-analyzer',
    kind: 'public_profile_analysis',
    repository: 'qeeqbox/social-analyzer',
    url: 'https://github.com/qeeqbox/social-analyzer',
    status: 'ADAPTER_PENDING',
    inputs: ['explicit_public_username'],
    outputs: ['public_profile_observations'],
  },
]);

function listProviders() {
  return PROVIDERS.map((provider) => ({ ...provider }));
}

function getProvider(id) {
  return PROVIDERS.find((provider) => provider.id === id) || null;
}

function normalizeObservation(providerId, observation) {
  return {
    provider: providerId,
    source: observation.source || providerId,
    observedAt: observation.observedAt || null,
    subject: observation.subject || null,
    name: observation.name || null,
    address: observation.address || null,
    parcelId: observation.parcelId || null,
    profileUrl: observation.profileUrl || null,
    confidence: Number.isFinite(observation.confidence) ? Math.max(0, Math.min(100, observation.confidence)) : null,
    ownershipStatus: observation.ownershipStatus || 'UNCONFIRMED',
  };
}

module.exports = { PROVIDERS, listProviders, getProvider, normalizeObservation };
