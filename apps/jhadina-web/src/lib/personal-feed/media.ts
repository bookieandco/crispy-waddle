import type { FeedItem } from './core';
import type { MediaTitle, RecommendationResult, ViewingSignal } from '@jhadina/jhadina-tv-core';

export function mediaRecommendationsToFeedItems(results: RecommendationResult[], signals: ViewingSignal[] = []): FeedItem[] {
  return results.map(({ title, score, reasons }) => ({
    id: `jhadinatv-${title.id}`,
    kind: 'media',
    label: 'JhadinaTV',
    title: title.title,
    body: reasons.length ? reasons.join(' · ') : title.overview,
    status: title.availability,
    href: `/jhadinatv/watch/${title.kind}/${title.id}`,
    action: 'Watch',
    relevance: score,
    platform: undefined,
  }));
}

export function catalogToMediaResults(catalog: MediaTitle[], signals: ViewingSignal[] = []): RecommendationResult[] {
  return catalog.map((title) => ({ title, score: signals.some((s) => s.titleId === title.id && s.liked) ? 20 : 0, reasons: signals.some((s) => s.titleId === title.id && s.liked) ? ['You liked this'] : [] })).filter((result) => result.score > 0);
}
