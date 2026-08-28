import type { GrowthId, ISODateTime } from '../domain/types.js';
import { scoreOpportunityV1, type OpportunityScoringV1Input, type OpportunityScoringV1Result } from './opportunity-scoring-v1.js';
import type { DistributionOpportunity, DistributionSignal } from './distribution-opportunity.js';

export interface TikTokTrendSignal {
  id: GrowthId;
  topic: string;
  observedAt: ISODateTime;
  velocity: number;
  views?: number;
  engagementRate?: number;
  sharesRate?: number;
  commentsRate?: number;
  savesRate?: number;
  ageHours?: number;
  format?: string;
  hook?: string;
  nicheRelevance: number;
  repeatability: number;
  creativeNovelty: number;
  monetizationPotential: number;
  productionDifficulty: number;
  evidenceQuality?: number;
  source?: string;
  surfaceId?: GrowthId;
}

export interface TikTokDistributionBridgeResult {
  signal: DistributionSignal;
  score: OpportunityScoringV1Result;
  opportunity: DistributionOpportunity;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function engagementQuality(signal: TikTokTrendSignal): number {
  const parts = [signal.engagementRate, signal.sharesRate, signal.commentsRate, signal.savesRate].filter((v): v is number => typeof v === 'number');
  if (!parts.length) return clamp(signal.evidenceQuality ?? 50);
  return clamp(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function recency(signal: TikTokTrendSignal): number {
  if (signal.ageHours === undefined) return 60;
  return clamp(100 * Math.exp(-signal.ageHours / 72));
}

function toScoreInput(signal: TikTokTrendSignal): OpportunityScoringV1Input {
  return {
    id: signal.id,
    velocity: signal.velocity,
    engagementQuality: engagementQuality(signal),
    recency: recency(signal),
    repeatability: signal.repeatability,
    nicheRelevance: signal.nicheRelevance,
    creativeNovelty: signal.creativeNovelty,
    monetizationPotential: signal.monetizationPotential,
    productionDifficulty: signal.productionDifficulty,
  };
}

export function bridgeTikTokTrendToDistributionOpportunity(signal: TikTokTrendSignal): TikTokDistributionBridgeResult {
  const score = scoreOpportunityV1(toScoreInput(signal));
  const surfaceId = signal.surfaceId ?? ('surface:tiktok' as GrowthId);
  const evidenceId = `tiktok-signal:${signal.id}` as GrowthId;
  const distributionSignal: DistributionSignal = {
    id: evidenceId,
    surfaceId,
    topic: signal.topic,
    audienceFit: clamp(signal.nicheRelevance),
    momentum: clamp(signal.velocity),
    intent: clamp(signal.monetizationPotential),
    evidenceQuality: clamp(signal.evidenceQuality ?? 50),
    observedAt: signal.observedAt,
    source: signal.source ?? 'tiktok',
  };

  const opportunity: DistributionOpportunity = {
    id: `distribution-opportunity:tiktok:${signal.id}` as GrowthId,
    surfaceId,
    title: `${signal.topic}${signal.format ? ` — ${signal.format}` : ''}`,
    rationale: `TikTok trend scored ${score.score}/100: velocity ${signal.velocity}, niche relevance ${signal.nicheRelevance}, repeatability ${signal.repeatability}, monetization ${signal.monetizationPotential}.`,
    score: score.score,
    reach: clamp(signal.velocity),
    audienceFit: clamp(signal.nicheRelevance),
    intent: clamp(signal.monetizationPotential),
    trend: clamp(signal.velocity),
    competition: clamp(100 - signal.creativeNovelty),
    costEfficiency: clamp(100 - signal.productionDifficulty),
    conversionPotential: clamp(signal.monetizationPotential),
    evidenceSignalIds: [evidenceId],
    recommendedAction: score.recommendation === 'scale' ? 'publish' : score.recommendation === 'stop' ? 'listen' : 'test',
  };

  return { signal: distributionSignal, score, opportunity };
}

export function bridgeTikTokTrends(signals: readonly TikTokTrendSignal[]): TikTokDistributionBridgeResult[] {
  return signals.map(bridgeTikTokTrendToDistributionOpportunity).sort((a, b) => b.score.score - a.score.score);
}
