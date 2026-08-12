import type { MediaSource, MediaSourceAdapter } from './source-adapter';
import type { MediaTitle } from './index';

export interface CatalogProvider {
  readonly id: string;
  readonly name: string;
  readonly sourceAdapter: MediaSourceAdapter;
  search(query: string): Promise<MediaTitle[]>;
}

export interface CatalogSearchOptions {
  query: string;
  providers?: string[];
}

export interface CatalogSearchResult {
  providerId: string;
  title: MediaTitle;
}

export interface ResolvedMediaSource {
  providerId: string;
  source: MediaSource;
}

export class CatalogRegistry {
  private readonly providers = new Map<string, CatalogProvider>();

  register(provider: CatalogProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`JhadinaTV provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  list(): CatalogProvider[] {
    return [...this.providers.values()];
  }

  async search(options: CatalogSearchOptions): Promise<CatalogSearchResult[]> {
    const selected = options.providers?.length
      ? options.providers.map((id) => this.providers.get(id)).filter(Boolean) as CatalogProvider[]
      : this.list();

    const results = await Promise.all(
      selected.map(async (provider) =>
        (await provider.search(options.query)).map((title) => ({ providerId: provider.id, title })),
      ),
    );

    return results.flat();
  }

  async resolveSources(providerId: string, titleId: string): Promise<ResolvedMediaSource[]> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown JhadinaTV provider: ${providerId}`);

    const sources = await provider.sourceAdapter.getSources(titleId);
    return sources.map((source) => ({ providerId, source }));
  }
}
