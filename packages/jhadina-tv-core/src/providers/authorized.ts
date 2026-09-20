import type { CatalogProvider } from '../catalog';
import type { MediaKind, MediaTitle } from '../index';
import type { MediaEdition, TVEpisode, TVSeason } from '../hierarchy';
import { assertEpisodeBelongsToSeason, assertTVEpisode, assertTVSeason, canonicalEpisodeId } from '../hierarchy';
import type { MediaSource, MediaSourceAdapter } from '../source-adapter';
import { createCatalogProvider } from '../providers';

export interface AuthorizedCatalogHierarchy {
  seriesId: string;
  season?: Omit<TVSeason, 'seriesId'>;
  episode?: Omit<TVEpisode, 'id' | 'seriesId' | 'seasonId'> & {
    id?: string;
    seasonId?: string;
  };
}

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
  hierarchy?: AuthorizedCatalogHierarchy;
  providerMediaId?: string;
  editionLabel?: string;
}

export interface NormalizedAuthorizedCatalogRecord {
  title: MediaTitle;
  season?: TVSeason;
  episode?: TVEpisode;
  edition?: MediaEdition;
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
      return (await client.search(query)).map((record) => normalizeAuthorizedCatalogRecord(record, config.id).title);
    },
    getSources: (titleId) => client.sources(titleId),
    async getSourcesForMedia(request) {
      const providerMediaId = request.providerMediaId ?? request.mediaId;
      return (await client.sources(providerMediaId)).map((source) => ({ ...source, titleId: request.mediaId }));
    },
  };

  return createCatalogProvider({ ...config, adapter });
}

export function normalizeAuthorizedCatalogRecord(record: AuthorizedCatalogRecord, providerId: string): NormalizedAuthorizedCatalogRecord {
  const title = toMediaTitle(record);
  if (!record.hierarchy) {
    return {
      title,
      edition: record.providerMediaId ? toEdition(record, providerId, title.id) : undefined,
    };
  }

  if (record.kind !== 'tv') throw new Error('Catalog hierarchy is only valid for TV records.');
  const { hierarchy } = record;
  if (!hierarchy.seriesId.trim()) throw new Error('Authorized catalog hierarchy seriesId is required.');

  const season = hierarchy.season
    ? assertTVSeason({ ...hierarchy.season, seriesId: hierarchy.seriesId })
    : undefined;

  let episode: TVEpisode | undefined;
  if (hierarchy.episode) {
    if (!season) throw new Error('Authorized catalog episodes require a season.');
    const episodeId = hierarchy.episode.id ?? canonicalEpisodeId(hierarchy.seriesId, hierarchy.episode.seasonNumber, hierarchy.episode.episodeNumber);
    episode = assertEpisodeBelongsToSeason(
      {
        ...hierarchy.episode,
        id: episodeId,
        seriesId: hierarchy.seriesId,
        seasonId: hierarchy.episode.seasonId ?? season.id,
      },
      season,
    );
  }

  const canonicalMediaId = episode?.id ?? hierarchy.seriesId;
  return {
    title: { ...title, id: canonicalMediaId },
    season,
    episode,
    edition: record.providerMediaId ? toEdition(record, providerId, canonicalMediaId) : undefined,
  };
}

function toEdition(record: AuthorizedCatalogRecord, providerId: string, mediaId: string): MediaEdition {
  if (!providerId.trim()) throw new Error('Media edition providerId is required.');
  if (!record.providerMediaId?.trim()) throw new Error('Media edition providerMediaId is required.');
  return {
    id: `${providerId}:${record.providerMediaId}`,
    mediaId,
    providerId,
    providerMediaId: record.providerMediaId,
    label: record.editionLabel,
    runtimeMinutes: record.runtimeMinutes,
  };
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
