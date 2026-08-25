import type { FeedItem } from './core';

export type IntelligenceSignalKind = 'trend' | 'mention' | 'insight' | 'recommendation';

export interface IntelligenceSignal {
  id: string;
  kind: IntelligenceSignalKind;
  title: string;
  body: string;
  relevance?: number;
  createdAt?: string;
  href?: string;
  action?: string;
  source?: string;
}

export function intelligenceSignalsToFeedItems(signals: IntelligenceSignal[]): FeedItem[] {
  return signals.map((signal) => ({
    id: `intelligence-${signal.id}`,
    kind: 'jhadina',
    label: signal.source ?? 'Jhadina',
    title: signal.title,
    body: signal.body,
    status: signal.kind,
    href: signal.href,
    action: signal.action ?? 'Review',
    relevance: signal.relevance ?? 0,
    createdAt: signal.createdAt,
  }));
}
