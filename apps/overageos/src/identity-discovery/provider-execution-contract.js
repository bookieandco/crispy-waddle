/**
 * Provider execution contract for OverageOS identity discovery.
 * Providers return observations only. They cannot verify entitlement or authorize outreach.
 */

const TERMINAL_PROVIDER_STATES = new Set(['COMPLETED', 'SKIPPED', 'FAILED', 'POLICY_BLOCKED']);

function validateProviderResult(result) {
  if (!result || typeof result !== 'object') throw new Error('Provider result must be an object');
  if (!result.provider) throw new Error('Provider name is required');
  if (!TERMINAL_PROVIDER_STATES.has(result.status)) throw new Error('Invalid provider status');
  if (!Array.isArray(result.observations)) throw new Error('Provider observations must be an array');

  return {
    provider: result.provider,
    status: result.status,
    observations: result.observations.map((observation) => ({
      ...observation,
      provenance: {
        provider: result.provider,
        observedAt: observation.provenance?.observedAt || new Date().toISOString(),
        source: observation.provenance?.source || result.provider,
      },
      ownershipStatus: observation.ownershipStatus || 'UNCONFIRMED',
      outreachStatus: 'NOT_AUTHORIZED',
    })),
  };
}

function buildProviderExecutionPlan({ providers, policy = {} }) {
  return providers.map((provider) => ({
    provider,
    enabled: policy[provider]?.enabled === true,
    mode: policy[provider]?.mode || 'AUTHORIZED_API_OR_CONFIGURED_ACCESS',
    humanReviewRequired: policy[provider]?.humanReviewRequired !== false,
  }));
}

module.exports = { validateProviderResult, buildProviderExecutionPlan };
