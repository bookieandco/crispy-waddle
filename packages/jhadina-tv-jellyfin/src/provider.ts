import type { CatalogProvider, MediaTitle, MediaSourceAdapter } from '@jhadina/tv-core';
import { mapJellyfinItemToMediaTitle } from './mapper';
import type { JellyfinApiTransport, JellyfinConnectionConfig, JellyfinItem } from './types';
import { createJellyfinTransport } from './client';
import { JellyfinSourceAdapter } from './source-adapter';

export interface JellyfinCatalogProviderConfig extends JellyfinConnectionConfig {
  providerId?: string;
  providerName?: string;
}

export class JellyfinCatalogProvider implements CatalogProvider {
  readonly id: string;
  readonly name: string;
  readonly sourceAdapter: MediaSourceAdapter;

  constructor(
    private readonly transport: JellyfinApiTransport,
    private readonly config: JellyfinCatalogProviderConfig,
  ) {
    this.id = config.providerId ?? 'jellyfin';
    this.name = config.providerName ?? 'Jellyfin';
    this.sourceAdapter = new JellyfinSourceAdapter(transport, config);
  }

  async search(query: string): Promise<MediaTitle[]> {
    const response = await this.transport.get<{ Items?: JellyfinItem[] }>('/Items', {
      UserId: this.config.userId,
      SearchTerm: query,
      IncludeItemTypes: 'Movie,Series,Episode',
      Recursive: true,
      EnableUserData: true,
      Fields: 'Overview,Genres,PrimaryImageAspectRatio,ProductionYear,RunTimeTicks',
      ImageTypeLimit: 2,
      Limit: 100,
    });

    return (response.Items ?? [])
      .map(mapJellyfinItemToMediaTitle)
      .filter((title): title is MediaTitle => title !== null)
      .map((title) => this.withImages(title));
  }

  private withImages(title: MediaTitle): MediaTitle {
    if (!this.config.imageUrlFactory) return title;

    return {
      ...title,
      posterUrl: this.config.imageUrlFactory(title.id, 'Primary'),
      backdropUrl: this.config.imageUrlFactory(title.id, 'Backdrop'),
    };
  }
}

export function createJellyfinProvider(config: JellyfinCatalogProviderConfig): JellyfinCatalogProvider {
  return new JellyfinCatalogProvider(createJellyfinTransport(config), config);
}
