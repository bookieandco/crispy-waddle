import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { TikTokTrendSignal } from './tiktok-distribution-bridge.js';

/**
 * Provider-neutral boundary for TikTok trend discovery.
 *
 * Growth Core never depends directly on TikTok API/auth/pagination details.
 * Concrete providers (TikAPI, internal collectors, exports, etc.) implement
 * this contract and normalize their responses into TikTokTrendSignal.
 */
export interface TikTokTrendQuery {
  niche?: string;
  topic?: string;
  limit?: number;
  observedAt?: ISODateTime;
}

export interface TikTokTrendProvider {
  readonly providerId: string;
  discoverTrends(query: TikTokTrendQuery): Promise<readonly TikTokTrendSignal[]>;
}

export interface TikTokRawTrendAdapter<TRaw> {
  normalize(raw: TRaw, context?: { observedAt?: ISODateTime; surfaceId?: GrowthId }): TikTokTrendSignal;
}

export interface TikTokTrendIngestionResult {
  providerId: string;
  observedAt: ISODateTime;
  signals: readonly TikTokTrendSignal[];
}

export async function ingestTikTokTrends(
  provider: TikTokTrendProvider,
  query: TikTokTrendQuery,
): Promise<TikTokTrendIngestionResult> {
  const observedAt = query.observedAt ?? new Date().toISOString();
  const signals = await provider.discoverTrends(query);

  return {
    providerId: provider.providerId,
    observedAt,
    signals,
  };
}
