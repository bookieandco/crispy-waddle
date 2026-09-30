import type { GrowthId } from '../domain/types.js';
import type { SocialPlatform } from './social-intelligence.js';

export interface SocialKnowledgeRecord {
  readonly id: GrowthId;
  readonly topic: string;
  readonly platform: SocialPlatform;
  readonly observedAt: string;
  readonly signalType: 'performance' | 'buyer_intent' | 'pattern' | 'experiment';
  readonly value: number;
  readonly confidence: number;
  readonly evidence: readonly GrowthId[];
}

export interface SocialKnowledgeSummary {
  readonly topic: string;
  readonly observationCount: number;
  readonly averageValue: number;
  readonly weightedValue: number;
  readonly confidence: number;
  readonly platforms: readonly SocialPlatform[];
  readonly lastObservedAt: string;
  readonly trend: 'rising' | 'falling' | 'stable';
  readonly evidence: readonly GrowthId[];
}

export function summarizeSocialKnowledge(
  records: readonly SocialKnowledgeRecord[],
): readonly SocialKnowledgeSummary[] {
  const groups = new Map<string, SocialKnowledgeRecord[]>();
  for (const record of records) {
    const key = record.topic.trim().toLowerCase();
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(record);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([topic, items]) => {
    const sorted = [...items].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const averageValue = items.reduce((sum, item) => sum + item.value, 0) / items.length;
    const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.confidence), 0) || 1;
    const weightedValue = items.reduce((sum, item) => sum + item.value * Math.max(0, item.confidence), 0) / totalWeight;
    const confidence = Math.min(1, items.reduce((sum, item) => sum + item.confidence, 0) / items.length);
    const midpoint = Math.max(1, Math.floor(sorted.length / 2));
    const early = sorted.slice(0, midpoint).reduce((sum, item) => sum + item.value, 0) / midpoint;
    const lateCount = sorted.length - midpoint;
    const late = lateCount > 0 ? sorted.slice(midpoint).reduce((sum, item) => sum + item.value, 0) / lateCount : early;
    const change = late - early;
    const scale = Math.max(1, Math.abs(averageValue));

    return {
      topic,
      observationCount: items.length,
      averageValue,
      weightedValue,
      confidence,
      platforms: [...new Set(items.map((item) => item.platform))],
      lastObservedAt: sorted.at(-1)?.observedAt ?? new Date(0).toISOString(),
      trend: change > scale * 0.1 ? 'rising' : change < -scale * 0.1 ? 'falling' : 'stable',
      evidence: [...new Set(items.flatMap((item) => item.evidence))],
    };
  }).sort((a, b) => b.weightedValue - a.weightedValue);
}
