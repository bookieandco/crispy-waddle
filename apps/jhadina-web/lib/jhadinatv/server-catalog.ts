import { CatalogRegistry, createAuthorizedCatalogAdapter, createDeterministicMediaAdvisor, createJhadinaTVRuntime } from '@jhadina/tv-core';
import { createJellyfinProviderBundle } from './jellyfin-provider';

/** Production never asserts fabricated demo titles are licensed/public-domain. */
const registry = new CatalogRegistry();
const jellyfin = createJellyfinProviderBundle();
if (jellyfin) {
  registry.register(createAuthorizedCatalogAdapter(jellyfin.catalogClient, { id: 'jellyfin', name: 'Jellyfin' }));
}

export const jhadinaTVLiveProvider = jellyfin?.liveProvider;
export const jhadinaTVServerRegistry = registry;
export const jhadinaTVServerRuntime = createJhadinaTVRuntime(registry, createDeterministicMediaAdvisor(), {
  getViewingSignals: async () => [],
  getMediaKnowledge: async () => [],
});
