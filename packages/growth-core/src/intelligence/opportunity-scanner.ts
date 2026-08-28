import type { GrowthId, ISODateTime } from '../domain/types.js';
import { scoreDistributionOpportunity, type DistributionOpportunity, type DistributionSignal } from './distribution-opportunity.js';
import { getDistributionSurface } from './distribution-registry.js';
import { scoreOpportunityV1 } from './opportunity-scoring-v1.js';

export interface RawGrowthSignal {
  id: GrowthId;
  surfaceId: string;
  topic: string;
  source: string;
  observedAt: ISODateTime;
  reach?: number;
  audienceFit: number;
  momentum: number;
  intent: number;
  competition?: number;
  costEfficiency?: number;
  conversionPotential?: number;
  evidenceQuality: number;
  engagementQuality?: number;
  recency?: number;
  repeatability?: number;
  nicheRelevance?: number;
  creativeNovelty?: number;
  monetizationPotential?: number;
  productionDifficulty?: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function normalizeGrowthSignal(raw: RawGrowthSignal): DistributionSignal {
  return {
    id: raw.id,
    surfaceId: raw.surfaceId,
    topic: raw.topic,
    audienceFit: clamp(raw.audienceFit),
    momentum: clamp(raw.momentum),
    intent: clamp(raw.intent),
    evidenceQuality: clamp(raw.evidenceQuality),
    observedAt: raw.observedAt,
    source: raw.source,
  };
}

export function scanGrowthSignal(raw: RawGrowthSignal): DistributionOpportunity | null {
  const surface = getDistributionSurface(raw.surfaceId);
  if (!surface) return null;

  const signal = normalizeGrowthSignal(raw);
  const opportunityId = `distribution-opportunity:${signal.id}`;

  const scoringV1 = scoreOpportunityV1({
    id: opportunityId,
    surfaceId: surface.id,
    topic: signal.topic,
    observedAt: signal.observedAt,
    velocity: signal.momentum,
    engagementQuality: raw.engagementQuality ?? raw.evidenceQuality,
    recency: raw.recency ?? signal.momentum,
    repeatability: raw.repeatability ?? 50,
    nicheRelevance: raw.nicheRelevance ?? signal.audienceFit,
    creativeNovelty: raw.creativeNovelty ?? 50,
    monetizationPotential: raw.monetizationPotential ?? signal.intent,
    productionDifficulty: raw.productionDifficulty ?? raw.costEfficiency ?? 50,
    evidenceSignalIds: [signal.id],
  });

  return {
    ...scoreDistributionOpportunity({
      id: opportunityId,
      surfaceId: surface.id,
      title: `${signal.topic} on ${surface.name}`,
      rationale: `Signal from ${signal.source} has ${signal.intent}/100 intent, ${signal.audienceFit}/100 audience fit, and ${signal.momentum}/100 momentum.`,
      reach: clamp(raw.reach ?? signal.momentum),
      audienceFit: signal.audienceFit,
      intent: signal.intent,
      trend: signal.momentum,
      competition: clamp(raw.competition ?? 50),
      costEfficiency: clamp(raw.costEfficiency ?? 50),
      conversionPotential: clamp(raw.conversionPotential ?? signal.intent),
      evidenceSignalIds: [signal.id],
      recommendedAction: surface.capabilities.includes('publish') ? 'test' : 'listen',
    }),
    score: scoringV1.score,
    scoringV1,
  };
}

export function scanGrowthSignals(signals: readonly RawGrowthSignal[]): DistributionOpportunity[] {
  return signals
    .map(scanGrowthSignal)
    .filter((opportunity): opportunity is DistributionOpportunity => opportunity !== null)
    .sort((a, b) => b.score - a.score);
}
