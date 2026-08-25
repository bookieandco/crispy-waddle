const { createProviderAdapter } = require('./provider');

/**
 * Adapters for Sherlock/Maigret/Social-Analyzer-style username discovery.
 * These accept a known username/handle and return observations. They intentionally
 * do not attempt to infer a person's username from sensitive personal attributes.
 */
function createUsernameDiscoveryAdapter({ name, discover }) {
  return createProviderAdapter({
    name,
    sourceClass: 'PUBLIC_SOCIAL',
    async discover(candidate) {
      if (!candidate || !candidate.username) return [];
      const results = await discover(candidate.username);
      return (Array.isArray(results) ? results : []).map((result) => ({
        source: name,
        sourceClass: 'PUBLIC_SOCIAL',
        sourceRecordId: result.id || result.url || null,
        observedIdentifiers: [candidate.username],
        observedAt: result.observedAt || new Date().toISOString(),
        provenance: result.url || result.provenance || null,
        reliability: Number.isFinite(result.reliability) ? result.reliability : 0,
        notes: result.platform || null,
      }));
    },
  });
}

module.exports = { createUsernameDiscoveryAdapter };
