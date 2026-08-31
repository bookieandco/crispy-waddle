import type { CatalogProvider } from './catalog';
import type { MediaProvider, MediaProviderCapabilities } from './media-domain';
import type { MediaSourceAdapter } from './source-adapter';

export interface ProviderFactoryConfig {
  id: string;
  name: string;
  adapter: MediaSourceAdapter;
  capabilities?: Partial<MediaProviderCapabilities>;
}

export function createCatalogProvider(config: ProviderFactoryConfig): CatalogProvider {
  return {
    id: config.id,
    name: config.name,
    sourceAdapter: config.adapter,
    search: (query) => config.adapter.search(query),
  };
}

export function registerCatalogProviders(
  registry: { register(provider: CatalogProvider): void },
  providers: CatalogProvider[],
): void {
  for (const provider of providers) registry.register(provider);
}

/** Bridges the legacy TV catalog provider into the canonical MediaProvider contract. */
export function toMediaProvider(provider: CatalogProvider): MediaProvider {
  const canonical: MediaProvider = {
    id: provider.id,
    name: provider.name,
    capabilities: {
      kinds: ['movie', 'show', 'season', 'episode', 'video'],
      supportsSearch: true,
      supportsBrowse: false,
      supportsSourceResolution: true,
    },
    async search(query) {
      const titles = await provider.search(query);
      return titles.map((title) => ({
        id: title.id,
        providerId: provider.id,
        provider: 'other',
        kind: title.kind === 'tv' ? 'show' : 'movie',
        title: title.title,
        description: title.overview,
        artworkUrl: title.posterUrl,
        backdropUrl: title.backdropUrl,
        durationMs: title.runtimeMinutes ? title.runtimeMinutes * 60_000 : undefined,
        canonicalUrl: title.watchUrl,
        capabilities: title.watchUrl ? ['play', 'seek', 'queue'] : [],
        metadata: { year: title.year, availability: title.availability },
      }));
    },
    async resolveSources(id) {
      const sources = await provider.sourceAdapter.getSources(id);
      return sources.map((source) => ({
        providerId: provider.id,
        itemId: id,
        url: source.url,
        type: source.type === 'hls' || source.type === 'dash' ? source.type : 'external',
      }));
    },
  };

  if (provider.get) {
    canonical.get = async (id) => {
      const title = await provider.get?.(id);
      if (!title) return undefined;
      return {
        id: title.id,
        providerId: provider.id,
        provider: 'other',
        kind: title.kind === 'tv' ? 'show' : 'movie',
        title: title.title,
        description: title.overview,
        artworkUrl: title.posterUrl,
        backdropUrl: title.backdropUrl,
        durationMs: title.runtimeMinutes ? title.runtimeMinutes * 60_000 : undefined,
        canonicalUrl: title.watchUrl,
        capabilities: title.watchUrl ? ['play', 'seek', 'queue'] : [],
        metadata: { year: title.year, availability: title.availability },
      };
    };
  }

  return canonical;
}
