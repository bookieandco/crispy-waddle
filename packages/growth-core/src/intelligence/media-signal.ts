import type { GrowthId } from '../domain/types.js';

export type MediaSourceType = 'social' | 'news' | 'podcast' | 'video' | 'web' | 'review' | 'forum';

export interface MediaSignal {
  readonly id: GrowthId;
  readonly source: string;
  readonly sourceType: MediaSourceType;
  readonly platform?: string;
  readonly observedAt: string;
  readonly publishedAt?: string;
  readonly entityRefs: readonly GrowthId[];
  readonly topicRefs: readonly GrowthId[];
  readonly audienceSignals: readonly string[];
  readonly contentRefs: readonly GrowthId[];
  readonly engagementSignals: Readonly<Record<string, number>>;
  readonly commercialSignals: Readonly<Record<string, number>>;
  readonly sentiment?: number;
  readonly confidence: number;
  readonly provenance: readonly string[];
  readonly permissions: readonly string[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function normalizeMediaSignal(input: Omit<MediaSignal, 'confidence'> & { confidence?: number }): MediaSignal {
  return { ...input, confidence: clamp(input.confidence ?? 0) };
}
