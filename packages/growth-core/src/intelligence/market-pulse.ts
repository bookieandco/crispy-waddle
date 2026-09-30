import type { GrowthId } from '../domain/types.js';
import type { SocialObservation, SocialPlatform } from './social-intelligence.js';

export interface SocialCluster {
  readonly id: GrowthId;
  readonly observationIds: readonly GrowthId[];
  readonly platforms: readonly SocialPlatform[];
  readonly normalizedTopic: string;
  readonly observationCount: number;
  readonly averageEngagementRate: number;
  readonly commercialSignalCount: number;
  readonly buyerSignalCount: number;
  readonly recencyScore: number;
}

export interface MarketPulse {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly clusters: readonly SocialCluster[];
  readonly risingTopics: readonly GrowthId[];
  readonly commercialTopics: readonly GrowthId[];
  readonly buyerIntentTopics: readonly GrowthId[];
}

function normalizeTopic(observation: SocialObservation): string {
  const source = observation.topic ?? observation.text ?? '';
  return source
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

function engagementRate(observation: SocialObservation): number {
  const { views = 0, likes = 0, comments = 0, shares = 0, saves = 0 } = observation.engagement;
  return views > 0 ? (likes + comments + shares + saves) / views : 0;
}

export function clusterSocialObservations(observations: readonly SocialObservation[]): readonly SocialCluster[] {
  const groups = new Map<string, SocialObservation[]>();
  for (const observation of observations) {
    const topic = normalizeTopic(observation);
    if (!topic) continue;
    const current = groups.get(topic) ?? [];
    current.push(observation);
    groups.set(topic, current);
  }

  return [...groups.entries()].map(([topic, items]) => {
    const rates = items.map(engagementRate);
    const averageEngagementRate = rates.reduce((sum, value) => sum + value, 0) / rates.length;
    const platforms = [...new Set(items.map((item) => item.platform))];
    const commercialSignalCount = items.reduce((sum, item) => sum + item.commercialSignals.length, 0);
    const buyerSignalCount = items.reduce((sum, item) => sum + item.audienceSignals.length, 0);
    const newest = Math.max(...items.map((item) => Date.parse(item.observedAt)).filter(Number.isFinite));
    const ageHours = Math.max(0, (Date.now() - newest) / 3_600_000);

    return {
      id: `social-cluster:${topic}` as GrowthId,
      observationIds: items.map((item) => item.id),
      platforms,
      normalizedTopic: topic,
      observationCount: items.length,
      averageEngagementRate,
      commercialSignalCount,
      buyerSignalCount,
      recencyScore: Math.max(0, Math.min(1, 1 / (1 + ageHours / 168))),
    };
  });
}

export function buildMarketPulse(
  observations: readonly SocialObservation[],
  windowStart: string,
  windowEnd: string,
): MarketPulse {
  const clusters = clusterSocialObservations(observations);
  const sorted = [...clusters].sort((a, b) => {
    const aScore = a.averageEngagementRate * Math.log1p(a.observationCount) * a.recencyScore;
    const bScore = b.averageEngagementRate * Math.log1p(b.observationCount) * b.recencyScore;
    return bScore - aScore;
  });

  return {
    windowStart,
    windowEnd,
    clusters,
    risingTopics: sorted.slice(0, 10).map((cluster) => cluster.id),
    commercialTopics: [...clusters]
      .filter((cluster) => cluster.commercialSignalCount > 0)
      .sort((a, b) => b.commercialSignalCount - a.commercialSignalCount)
      .slice(0, 10)
      .map((cluster) => cluster.id),
    buyerIntentTopics: [...clusters]
      .filter((cluster) => cluster.buyerSignalCount > 0)
      .sort((a, b) => b.buyerSignalCount - a.buyerSignalCount)
      .slice(0, 10)
      .map((cluster) => cluster.id),
  };
}
