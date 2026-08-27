import type { GrowthId } from '../domain/types.js';
import type { ContentPerformance } from './content-performance.js';

export interface SocialPerformanceSnapshot {
  platform: string;
  providerPostId: string;
  assetId: GrowthId;
  capturedAt: string;
  impressions?: number;
  views?: number;
  twoSecondViewRate?: number;
  averageWatchSeconds?: number;
  completionRate?: number;
  ctr?: number;
  saves?: number;
  comments?: number;
  shares?: number;
  leads?: number;
  purchases?: number;
  spend?: number;
  revenue?: number;
}

/** Normalize provider telemetry into the Growth Core's canonical content shape. */
export function normalizeSocialPerformance(input: SocialPerformanceSnapshot): ContentPerformance {
  const nonNegative = (value: number | undefined): number | undefined =>
    value === undefined ? undefined : Math.max(0, value);

  return {
    assetId: input.assetId,
    platform: input.platform.trim().toLowerCase(),
    impressions: Math.max(0, input.impressions ?? 0),
    views: Math.max(0, input.views ?? 0),
    twoSecondViewRate: nonNegative(input.twoSecondViewRate),
    averageWatchSeconds: nonNegative(input.averageWatchSeconds),
    completionRate: nonNegative(input.completionRate),
    ctr: nonNegative(input.ctr),
    saves: nonNegative(input.saves),
    comments: nonNegative(input.comments),
    shares: nonNegative(input.shares),
    leads: nonNegative(input.leads),
    purchases: nonNegative(input.purchases),
    spend: nonNegative(input.spend),
    revenue: nonNegative(input.revenue),
  };
}

export interface SocialPerformanceIngestionResult {
  accepted: ContentPerformance[];
  rejected: Array<{ providerPostId: string; reason: string }>;
}

/** Batch boundary for connector/webhook adapters. Invalid snapshots are isolated. */
export function ingestSocialPerformance(
  snapshots: readonly SocialPerformanceSnapshot[],
): SocialPerformanceIngestionResult {
  const accepted: ContentPerformance[] = [];
  const rejected: Array<{ providerPostId: string; reason: string }> = [];

  for (const snapshot of snapshots) {
    if (!snapshot.platform.trim()) {
      rejected.push({ providerPostId: snapshot.providerPostId, reason: 'platform is required' });
      continue;
    }
    if (!snapshot.providerPostId.trim()) {
      rejected.push({ providerPostId: snapshot.providerPostId, reason: 'providerPostId is required' });
      continue;
    }
    if (!snapshot.assetId) {
      rejected.push({ providerPostId: snapshot.providerPostId, reason: 'assetId is required' });
      continue;
    }
    accepted.push(normalizeSocialPerformance(snapshot));
  }

  return { accepted, rejected };
}
