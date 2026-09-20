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
  evidenceIds?: string[];
  providerId?: string;
}

export type ViewingSignalKind = 'explicit-preference' | 'observed-behavior' | 'temporary-intent' | 'contextual';

export interface ViewingSignal {
  titleId: string;
  completed: boolean;
  progressMinutes: number;
  liked?: boolean;
  kind?: ViewingSignalKind;
  observedAt?: string;
  confidence?: number;
  source?: string;
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

export function recommendTitles(catalog: MediaTitle[], request: RecommendationRequest): RecommendationResult[] {
  const queryTokens = normalize(request.query ?? '').split(/\s+/).filter(Boolean);
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
        score += related.kind === 'explicit-preference' ? 25 : 20;
        reasons.push(related.kind === 'explicit-preference' ? 'Builds on an explicit preference' : 'Builds on something you liked');
      }
      if (title.availability !== 'external-link') {
        score += 5;
        reasons.push('Available through a configured JhadinaTV source');
      }
      return { title, score, reasons };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.id.localeCompare(b.title.id));
}

export const JHADINA_TV_ROUTES = {
  home: '/jhadinatv',
  movies: '/jhadinatv/movies',
  tv: '/jhadinatv/tv',
  search: '/jhadinatv/search',
  watch: (kind: MediaKind, id: string) => `/jhadinatv/watch/${kind}/${id}`,
};

export type { MediaRight, MediaSource, MediaSourceAdapter, MediaSourceAuthorization } from './source-adapter';
export { assertAuthorizedSource, assertMediaRight, assertPlayableSource } from './source-adapter';
export type { CastingManager, MediaSessionCommand, MediaSessionController, MediaSessionState, PlaybackTarget, PlaybackTransport } from './casting';
export { assertCastableSource, buildTransferCommand, createCastingManager } from './casting';
export type { CatalogProvider, CatalogSearchOptions, CatalogSearchResult, ResolvedMediaSource } from './catalog';
export { CatalogRegistry } from './catalog';
export type { ProviderFactoryConfig } from './providers';
export { createCatalogProvider, registerCatalogProviders } from './providers';
export type { AuthorizedCatalogClient, AuthorizedCatalogHierarchy, AuthorizedCatalogRecord, NormalizedAuthorizedCatalogRecord } from './providers/authorized';
export { createAuthorizedCatalogAdapter, normalizeAuthorizedCatalogRecord } from './providers/authorized';
export type { GoogleCastRuntime, GoogleCastSession } from './cast/google-cast';
export { createGoogleCastController } from './cast/google-cast';
export type { JhadinaTVReceiverTransport } from './cast/jhadinatv-receiver';
export { createJhadinaTVReceiverController } from './cast/jhadinatv-receiver';
export type { AirPlayVideo } from './cast/browser-airplay';
export { createBrowserAirPlayController } from './cast/browser-airplay';
export type { PictureInPictureController, PictureInPictureDocument, PictureInPictureVideo } from './picture-in-picture';
export { createPictureInPictureController } from './picture-in-picture';
export type { LocalPlaybackAdapter, UnifiedMediaSession, UnifiedMediaSessionConfig } from './media-session';
export { createUnifiedMediaSession } from './media-session';
export type {
  AskJhadinaMediaPort,
  ClaimConfidence,
  EvidenceKind,
  EvidenceRef,
  MediaClaim,
  MediaIntelligenceSnapshot,
  MediaKnowledge,
  MediaPerceptionInput,
  MediaRecommendationContext,
  MediaRecommendationExplanation,
  MediaSceneEvent,
  ViewingSignalStore,
} from './media-intelligence';
export {
  buildMediaKnowledge,
  createDeterministicMediaAdvisor,
  createInMemoryViewingSignalStore,
  createMediaIntelligenceSnapshot,
  evidenceForClaim,
  explainRecommendation,
} from './media-intelligence';

export type { JhadinaMediaContextPort, JhadinaTVRuntime } from './runtime';
export { createJhadinaTVRuntime } from './runtime';
export type { ViewingMemoryProposal, ViewingMemoryProposalPort } from './viewing-memory';
export { proposeViewingMemory, toViewingMemoryProposal } from './viewing-memory';
export type { MediaPerceptionAdapter } from './perception';
export { perceiveAuthorizedMedia } from './perception';

export type { MediaEdition, TVEntityKind, TVEpisode, TVHierarchyEntity, TVSeason, TVSeries } from './hierarchy';
export { assertEpisodeBelongsToSeason, assertTVEpisode, assertTVSeason, canonicalEpisodeId, seriesFromMediaTitle } from './hierarchy';
