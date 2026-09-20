import type { MediaTitle } from './index';

export type TVEntityKind = 'series' | 'season' | 'episode';

export interface TVSeries {
  id: string;
  kind: 'series';
  title: string;
  overview: string;
  year: number;
  genres: string[];
  posterUrl?: string;
  backdropUrl?: string;
}

export interface TVSeason {
  id: string;
  kind: 'season';
  seriesId: string;
  seasonNumber: number;
  title?: string;
  overview?: string;
  posterUrl?: string;
  releaseYear?: number;
}

export interface TVEpisode {
  id: string;
  kind: 'episode';
  seriesId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  runtimeMinutes?: number;
  releaseDate?: string;
  posterUrl?: string;
}

export interface MediaEdition {
  id: string;
  mediaId: string;
  providerId: string;
  providerMediaId: string;
  label?: string;
  runtimeMinutes?: number;
}

export type TVHierarchyEntity = TVSeries | TVSeason | TVEpisode;

function requireId(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer.`);
}

export function assertTVSeason(season: TVSeason): TVSeason {
  requireId(season.id, 'TV season id');
  requireId(season.seriesId, 'TV season seriesId');
  requirePositiveInteger(season.seasonNumber, 'TV season number');
  return season;
}

export function assertTVEpisode(episode: TVEpisode): TVEpisode {
  requireId(episode.id, 'TV episode id');
  requireId(episode.seriesId, 'TV episode seriesId');
  requireId(episode.seasonId, 'TV episode seasonId');
  requirePositiveInteger(episode.seasonNumber, 'TV episode season number');
  requirePositiveInteger(episode.episodeNumber, 'TV episode number');
  requireId(episode.title, 'TV episode title');
  return episode;
}

export function assertEpisodeBelongsToSeason(episode: TVEpisode, season: TVSeason): TVEpisode {
  assertTVEpisode(episode);
  assertTVSeason(season);
  if (episode.seriesId !== season.seriesId) throw new Error('TV episode and season must belong to the same series.');
  if (episode.seasonId !== season.id) throw new Error('TV episode seasonId does not match the season.');
  if (episode.seasonNumber !== season.seasonNumber) throw new Error('TV episode season number does not match the season.');
  return episode;
}

/**
 * Creates the canonical series identity from the existing JhadinaTV title model.
 * Keeping MediaTitle as the catalog/playback boundary preserves JTV-31 compatibility.
 */
export function seriesFromMediaTitle(title: MediaTitle): TVSeries {
  if (title.kind !== 'tv') throw new Error('Only TV MediaTitle records can become a TV series.');
  return {
    id: title.id,
    kind: 'series',
    title: title.title,
    overview: title.overview,
    year: title.year,
    genres: [...title.genres],
    posterUrl: title.posterUrl,
    backdropUrl: title.backdropUrl,
  };
}

export function canonicalEpisodeId(seriesId: string, seasonNumber: number, episodeNumber: number): string {
  requireId(seriesId, 'TV series id');
  requirePositiveInteger(seasonNumber, 'TV season number');
  requirePositiveInteger(episodeNumber, 'TV episode number');
  return `${seriesId}:s${seasonNumber}:e${episodeNumber}`;
}
