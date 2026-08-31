import type { MediaItem, MediaProvider } from './media-domain';

export interface MediaProviderStatus {
  id: string;
  name: string;
  enabled: boolean;
  healthy: boolean;
  message?: string;
  checkedAt?: string;
}

export class MediaProviderRegistry {
  private readonly providers = new Map<string, MediaProvider>();

  register(provider: MediaProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Media provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  get(providerId: string): MediaProvider | undefined {
    return this.providers.get(providerId);
  }

  async getItem(providerId: string, itemId: string): Promise<MediaItem | undefined> {
    const provider = this.providers.get(providerId);
    if (!provider?.get) return undefined;
    return provider.get(itemId);
  }

  async resolveItemSources(providerId: string, itemId: string) {
    const provider = this.providers.get(providerId);
    if (!provider?.resolveSources) return [];
    return provider.resolveSources(itemId);
  }

  list(): MediaProvider[] {
    return [...this.providers.values()];
  }

  async search(query: string, providerIds?: string[]): Promise<Awaited<ReturnType<MediaProvider['search']>>> {
    const selected = providerIds?.length
      ? providerIds.map((id) => this.providers.get(id)).filter((provider): provider is MediaProvider => Boolean(provider))
      : this.list();

    const results = await Promise.all(
      selected
        .filter((provider) => provider.capabilities.supportsSearch)
        .map((provider) => provider.search(query)),
    );

    return results.flat();
  }

  async health(): Promise<MediaProviderStatus[]> {
    const checkedAt = new Date().toISOString();
    return Promise.all(this.list().map(async (provider) => {
      if (!provider.health) {
        return { id: provider.id, name: provider.name, enabled: true, healthy: true, checkedAt };
      }
      try {
        const result = await provider.health();
        return { id: provider.id, name: provider.name, enabled: true, healthy: result.ok, message: result.message, checkedAt };
      } catch (error) {
        return {
          id: provider.id,
          name: provider.name,
          enabled: true,
          healthy: false,
          message: error instanceof Error ? error.message : 'Provider health check failed',
          checkedAt,
        };
      }
    }));
  }
}
