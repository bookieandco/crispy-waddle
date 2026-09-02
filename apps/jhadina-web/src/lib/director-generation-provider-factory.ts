import type { GenerationProvider } from '@jhadina/director-core';

/**
 * Canonical server-only Director provider construction boundary.
 *
 * Provider-specific clients must be constructed here, never independently by
 * request handlers or reconciliation jobs. Runtime configuration is explicit
 * and missing provider configuration fails closed.
 */
export function createDirectorGenerationProviders(): Map<string, GenerationProvider> {
  const providers = new Map<string, GenerationProvider>();

  // Provider construction is intentionally explicit. Add a provider here only
  // when its credentials/configuration and client factory are available.
  // The Director runtime must never fabricate a provider from catalog metadata.
  return providers;
}
