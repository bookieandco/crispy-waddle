import type { CatalogProvider } from './catalog';
import type { MediaSourceAdapter } from './source-adapter';

export interface ProviderFactoryConfig {
  id: string;
  name: string;
  adapter: MediaSourceAdapter;
}

/**
 * Wraps an authorized source adapter as a catalog provider.
 * Network/authentication details stay outside the core package.
 */
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
