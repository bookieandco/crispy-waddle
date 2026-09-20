import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { EvidenceItem } from './evidence-contract.js';
import type { RawGrowthSignal } from '../intelligence/opportunity-scanner.js';

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

function metric(item: EvidenceItem, name: string, fallback = 0): number {
  const value = item.metrics?.[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Converts normalized evidence into the existing Growth Core signal contract.
 * This is deliberately deterministic; AI enrichment belongs upstream of this boundary.
 */
export function evidenceToGrowthSignal(item: EvidenceItem, surfaceId: string, topic?: string): RawGrowthSignal {
  const engagement = metric(item, 'engagementRate', metric(item, 'engagement', 0));
  const momentum = metric(item, 'momentum', metric(item, 'growthRate', engagement));
  const intent = metric(item, 'intent', metric(item, 'conversionPotential', 50));
  const audienceFit = metric(item, 'audienceFit', 50);
  const evidenceQuality = metric(item, 'evidenceQuality', item.text || item.uri ? 70 : 40);

  return {
    id: (`growth-signal:${item.id}` as GrowthId),
    surfaceId,
    topic: topic ?? item.title,
    source: item.source,
    observedAt: item.capturedAt as ISODateTime,
    reach: metric(item, 'reach'),
    audienceFit: clamp(audienceFit),
    momentum: clamp(momentum),
    intent: clamp(intent),
    competition: clamp(metric(item, 'competition', 50)),
    costEfficiency: clamp(metric(item, 'costEfficiency', 50)),
    conversionPotential: clamp(metric(item, 'conversionPotential', intent)),
    evidenceQuality: clamp(evidenceQuality),
  };
}

export function evidenceToGrowthSignals(
  items: readonly EvidenceItem[],
  surfaceId: string,
): RawGrowthSignal[] {
  return items.map((item) => evidenceToGrowthSignal(item, surfaceId));
}
