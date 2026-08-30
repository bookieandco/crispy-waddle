import type { GrowthId } from '../domain/types.js';

export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'threads'
  | 'bluesky'
  | 'pinterest'
  | 'reddit'
  | 'other';

export type SocialMediaType = 'text' | 'image' | 'video' | 'carousel' | 'live' | 'other';

export type BuyerIntentLevel = 'none' | 'low' | 'medium' | 'high';

export interface SocialEngagement {
  readonly views?: number;
  readonly likes?: number;
  readonly comments?: number;
  readonly shares?: number;
  readonly saves?: number;
}

export interface SocialObservation {
  readonly id: GrowthId;
  readonly brandId?: GrowthId;
  readonly platform: SocialPlatform;
  readonly sourceUrl: string;
  readonly creatorId?: string;
  readonly contentId?: string;
  readonly publishedAt?: string;
  readonly observedAt: string;
  readonly topic?: string;
  readonly mediaType: SocialMediaType;
  readonly text?: string;
  readonly engagement: SocialEngagement;
  readonly audienceSignals: readonly string[];
  readonly commercialSignals: readonly string[];
  readonly provenance: readonly string[];
}

export interface SocialPerformanceSignal {
  readonly observationId: GrowthId;
  readonly engagementRate?: number;
  readonly engagementVelocity?: number;
  readonly creatorBaseline?: number;
  readonly performanceLift?: number;
  readonly recencyScore: number;
  readonly crossPlatformPresence: number;
  readonly confidence: number;
}

export interface SocialPattern {
  readonly id: GrowthId;
  readonly sourceObservationIds: readonly GrowthId[];
  readonly platforms: readonly SocialPlatform[];
  readonly topic?: string;
  readonly hook?: string;
  readonly format?: string;
  readonly structure?: string;
  readonly durationSeconds?: number;
  readonly visualPattern?: string;
  readonly emotionalDriver?: string;
  readonly cta?: string;
  readonly audienceSignals: readonly string[];
  readonly performanceLift?: number;
  readonly confidence: number;
}

export interface BuyerIntentSignal {
  readonly id: GrowthId;
  readonly observationId: GrowthId;
  readonly level: BuyerIntentLevel;
  readonly productOrTopic?: string;
  readonly signalType: string;
  readonly evidence: readonly string[];
  readonly recencyScore: number;
  readonly confidence: number;
}

export interface AdvertisingIntelligenceCandidate {
  readonly id: GrowthId;
  readonly patternId: GrowthId;
  readonly sourceObservationIds: readonly GrowthId[];
  readonly audienceSignals: readonly string[];
  readonly commercialRelevance: number;
  readonly brandFit: number;
  readonly audienceFit: number;
  readonly novelty: number;
  readonly risk: number;
  readonly confidence: number;
  readonly createdAt: string;
}

export function calculateBuyerIntentLevel(signals: readonly string[]): BuyerIntentLevel {
  const text = signals.join(' ').toLowerCase();
  const highIntent = ['where can i buy', 'how much', 'price', 'buy this', 'purchase', 'available', 'shipping', 'link'];
  const mediumIntent = ['which one', 'recommend', 'looking for', 'need this', 'save this', 'want this'];

  if (highIntent.some((signal) => text.includes(signal))) return 'high';
  if (mediumIntent.some((signal) => text.includes(signal))) return 'medium';
  if (signals.length > 0) return 'low';
  return 'none';
}

export function scoreAdvertisingCandidate(input: {
  commercialRelevance: number;
  brandFit: number;
  audienceFit: number;
  novelty: number;
  risk: number;
  confidence: number;
}): number {
  const positive =
    input.commercialRelevance * 0.25 +
    input.brandFit * 0.2 +
    input.audienceFit * 0.2 +
    input.novelty * 0.1 +
    input.confidence * 0.25;

  return Math.max(0, Math.min(1, positive - input.risk * 0.2));
}
