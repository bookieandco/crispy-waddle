import type { CatalogProvider } from '../catalog';
import type { MediaKind, MediaTitle } from '../index';
import type { MediaSource, MediaSourceAdapter } from '../source-adapter';
import { createCatalogProvider } from '../providers';

export interface AuthorizedCatalogRecord {
  id: string;
  kind: MediaKind;
  title: string;
  overview: string;
  year: number;
  genres?: string[];
  runtimeMinutes?: number;
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  availability: 'owned' | 'licensed' | 'public-domain' | 'external-link';
  watchUrl?: string;
}

export interface AuthorizedCatalogClient {
  search(query: string): Promise<AuthorizedCatalogRecord[]>;
  sources(titleId: string): Promise<MediaSource[]>;
}

export function createAuthorizedCatalogAdapter(
  client: AuthorizedCatalogClient,
  config: { id: string; name: string },
): CatalogProvider {
  const adapter: MediaSourceAdapter = {
    id: config.id,
    name: config.name,
    async search(query) {
      return (await client.search(query)).map(toMediaTitle);
    },
    getSources: (titleId) => client.sources(titleId),
  };

  return createCatalogProvider({ ...config, adapter });
}

function toMediaTitle(record: AuthorizedCatalogRecord): MediaTitle {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    overview: record.overview,
    year: record.year,
    runtimeMinutes: record.runtimeMinutes,
    genres: record.genres ?? [],
    rating: record.rating,
    posterUrl: record.posterUrl,
    backdropUrl: record.backdropUrl,
    availability: record.availability,
    watchUrl: record.watchUrl,
  };
}
