import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { OpportunityScoringV1Result } from './opportunity-scoring-v1.js';

export type GrowthSurfaceKind = 'social' | 'search' | 'community' | 'creator' | 'email' | 'paid' | 'partnership' | 'marketplace' | 'other';

export interface DistributionSurface {
  id: GrowthId;
  kind: GrowthSurfaceKind;
  name: string;
  enabled: boolean;
  capabilities: readonly ('listen' | 'publish' | 'engage' | 'paid' | 'measure')[];
}

export interface DistributionSignal {
  id: GrowthId;
  surfaceId: GrowthId;
  topic: string;
  audienceFit: number;
  momentum: number;
  intent: number;
  evidenceQuality: number;
  observedAt: ISODateTime;
  source: string;
}

export interface DistributionOpportunity {
  id: GrowthId;
  surfaceId: GrowthId;
  title: string;
  rationale: string;
  score: number;
  scoringV1?: OpportunityScoringV1Result;
  reach: number;
  audienceFit: number;
  intent: number;
  trend: number;
  competition: number;
  costEfficiency: number;
  conversionPotential: number;
  evidenceSignalIds: readonly GrowthId[];
  recommendedAction: 'listen' | 'create' | 'publish' | 'engage' | 'test' | 'sponsor';
}

export function scoreDistributionOpportunity(input: Omit<DistributionOpportunity, 'score'>): DistributionOpportunity {
  const score = input.reach * 0.10 + input.audienceFit * 0.22 + input.intent * 0.20 + input.trend * 0.14 + input.competition * 0.10 + input.costEfficiency * 0.10 + input.conversionPotential * 0.14;
  return { ...input, score: Math.round(score * 100) / 100 };
}
