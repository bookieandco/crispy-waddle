const { resolveCandidate } = require('./corroboration');

/**
 * Runs configured discovery providers against an already-authorized candidate.
 * Providers are observation sources; verification remains a separate gate.
 */
async function runIdentityDiscovery({ candidate, providers = [] }) {
  const observations = [];
  const errors = [];

  for (const provider of providers) {
    try {
      const result = await provider.discover(candidate);
      if (Array.isArray(result)) observations.push(...result);
    } catch (error) {
      errors.push({ provider: provider.name, error: error.message });
    }
  }

  const resolved = resolveCandidate({
    evidence: observations,
    contacts: [],
    conflicts: [],
  });

  return {
    candidate,
    ...resolved,
    providerCount: providers.length,
    providerErrors: errors,
    liveProviderData: observations.length > 0,
  };
}

module.exports = { runIdentityDiscovery };
