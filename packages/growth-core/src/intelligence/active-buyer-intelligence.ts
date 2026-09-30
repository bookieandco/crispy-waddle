import type { GrowthId } from '../domain/types.js';
import type { BuyerIntentLevel, SocialObservation, SocialPlatform } from './social-intelligence.js';
import { analyzeBuyerSignals } from './social-discovery.js';

export interface ActiveBuyerSignal {
  readonly id: GrowthId;
  readonly platform: SocialPlatform;
  readonly topic: string;
  readonly intentLevel: BuyerIntentLevel;
  readonly evidence: readonly string[];
  readonly recencyScore: number;
  readonly confidence: number;
}

export interface ActiveBuyerCluster {
  readonly id: GrowthId;
  readonly topic: string;
  readonly platforms: readonly SocialPlatform[];
  readonly signalCount: number;
  readonly highIntentCount: number;
  readonly recencyScore: number;
  readonly confidence: number;
  readonly evidence: readonly GrowthId[];
}

export function extractActiveBuyerSignal(observation: SocialObservation): ActiveBuyerSignal {
  const evidence = [...observation.audienceSignals, ...observation.commercialSignals];
  const analysis = analyzeBuyerSignals(evidence);
  const ageHours = Math.max(0, (Date.now() - Date.parse(observation.observedAt)) / 3_600_000);
  const recencyScore = Math.max(0, Math.min(1, 1 / (1 + ageHours / 72)));

  return {
    id: `buyer-signal:${observation.id}` as GrowthId,
    platform: observation.platform,
    topic: observation.topic ?? 'unknown',
    intentLevel: analysis.level,
    evidence: analysis.matchedSignals,
    recencyScore,
    confidence: Math.min(1, analysis.confidence * (0.7 + recencyScore * 0.3)),
  };
}

export function aggregateActiveBuyers(
  observations: readonly SocialObservation[],
): readonly ActiveBuyerCluster[] {
  const groups = new Map<string, ActiveBuyerSignal[]>();
  for (const observation of observations) {
    const signal = extractActiveBuyerSignal(observation);
    if (signal.intentLevel === 'none') continue;
    const topic = signal.topic.toLowerCase().trim() || 'unknown';
    const current = groups.get(topic) ?? [];
    current.push(signal);
    groups.set(topic, current);
  }

  return [...groups.entries()].map(([topic, signals]) => {
    const highIntentCount = signals.filter((signal) => signal.intentLevel === 'high').length;
    const recencyScore = signals.reduce((sum, signal) => sum + signal.recencyScore, 0) / signals.length;
    const evidence = signals.map((signal) => signal.id);
    const platformCount = new Set(signals.map((signal) => signal.platform)).size;
    const confidence = Math.min(1, (highIntentCount / signals.length) * 0.5 + recencyScore * 0.3 + Math.min(1, platformCount / 3) * 0.2);

    return {
      id: `active-buyers:${topic}` as GrowthId,
      topic,
      platforms: [...new Set(signals.map((signal) => signal.platform))],
      signalCount: signals.length,
      highIntentCount,
      recencyScore,
      confidence,
      evidence,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}
