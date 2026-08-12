export type MediaKind = 'movie' | 'tv';

export type AvailabilityKind = 'owned' | 'licensed' | 'public-domain' | 'external-link';

export interface MediaTitle {
  id: string;
  kind: MediaKind;
  title: string;
  overview: string;
  year: number;
  runtimeMinutes?: number;
  genres: string[];
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  availability: AvailabilityKind;
  watchUrl?: string;
}

export interface ViewingSignal {
  titleId: string;
  completed: boolean;
  progressMinutes: number;
  liked?: boolean;
}

export interface RecommendationRequest {
  query?: string;
  maxRuntimeMinutes?: number;
  genres?: string[];
  signals?: ViewingSignal[];
}

export interface RecommendationResult {
  title: MediaTitle;
  score: number;
  reasons: string[];
}

const normalize = (value: string) => value.trim().toLowerCase();

export function recommendTitles(
  catalog: MediaTitle[],
  request: RecommendationRequest,
): RecommendationResult[] {
  const queryTokens = normalize(request.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const wantedGenres = new Set((request.genres ?? []).map(normalize));
  const signals = request.signals ?? [];

  return catalog
    .map((title) => {
      let score = 0;
      const reasons: string[] = [];
      const searchable = normalize(`${title.title} ${title.overview} ${title.genres.join(' ')}`);

      const queryMatches = queryTokens.filter((token) => searchable.includes(token));
      if (queryMatches.length) {
        score += Math.min(45, queryMatches.length * 15);
        reasons.push(`Matches your search for ${queryMatches.join(', ')}`);
      }

      const genreMatches = title.genres.filter((genre) => wantedGenres.has(normalize(genre)));
      if (genreMatches.length) {
        score += genreMatches.length * 15;
        reasons.push(`Matches ${genreMatches.join(' and ')} preferences`);
      }

      if (request.maxRuntimeMinutes && title.runtimeMinutes) {
        if (title.runtimeMinutes <= request.maxRuntimeMinutes) {
          score += 10;
          reasons.push(`Fits your ${request.maxRuntimeMinutes}-minute limit`);
        } else {
          score -= 20;
        }
      }

      const related = signals.find((signal) => signal.titleId === title.id);
      if (related?.liked) {
        score += 20;
        reasons.push('Builds on something you liked');
      }

      if (title.availability !== 'external-link') {
        score += 5;
        reasons.push('Available through a configured JhadinaTV source');
      }

      return { title, score, reasons };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

export const JHADINA_TV_ROUTES = {
  home: '/jhadinatv',
  movies: '/jhadinatv/movies',
  tv: '/jhadinatv/tv',
  search: '/jhadinatv/search',
  watch: (kind: MediaKind, id: string) => `/jhadinatv/watch/${kind}/${id}`,
};

export type { MediaSource, MediaSourceAdapter } from './source-adapter';
export { assertPlayableSource } from './source-adapter';
