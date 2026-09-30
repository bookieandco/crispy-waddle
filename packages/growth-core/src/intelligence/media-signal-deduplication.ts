import type { GrowthId } from '../domain/types.js';
import type { MediaSignal } from './media-signal.js';

export interface SignalCluster {
  readonly id: GrowthId;
  readonly representativeId: GrowthId;
  readonly signalIds: readonly GrowthId[];
  readonly sourceCount: number;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly sourceTypes: readonly string[];
  readonly confidence: number;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const overlap = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a.map(normalize));
  return b.some((value) => left.has(normalize(value)));
};

export function areLikelyDuplicates(a: MediaSignal, b: MediaSignal): boolean {
  if (a.id === b.id) return true;
  if (!overlap(a.entityRefs, b.entityRefs) && !overlap(a.topicRefs, b.topicRefs)) return false;
  const aTime = Date.parse(a.publishedAt ?? a.observedAt);
  const bTime = Date.parse(b.publishedAt ?? b.observedAt);
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= 24 * 60 * 60 * 1000;
}

export function aggregateSignalCluster(signals: readonly MediaSignal[]): SignalCluster | null {
  if (!signals.length) return null;
  const sorted = [...signals].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const representative = sorted[0];
  const sourceTypes = [...new Set(sorted.map((signal) => signal.sourceType))];
  const confidence = sorted.reduce((sum, signal) => sum + signal.confidence, 0) / sorted.length;
  return {
    id: `cluster:${representative.id}` as GrowthId,
    representativeId: representative.id,
    signalIds: sorted.map((signal) => signal.id),
    sourceCount: new Set(sorted.map((signal) => signal.source)).size,
    firstObservedAt: sorted[0].observedAt,
    lastObservedAt: sorted[sorted.length - 1].observedAt,
    sourceTypes,
    confidence,
  };
}
