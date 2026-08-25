import type { CapitalDomain } from './taxonomy';
import type { OpportunityCandidate } from './opportunity-engine';

export type OpportunitySource =
  | 'market'
  | 'forex'
  | 'crypto'
  | 'sports'
  | 'prediction-market'
  | 'mining';

export type UnifiedOpportunity = OpportunityCandidate & {
  source: OpportunitySource;
  asset?: string;
  venue?: string;
  metadata: Record<string, unknown>;
};

export type OpportunityFeed = {
  observedAt: string;
  opportunities: UnifiedOpportunity[];
};

/**
 * Normalizes heterogeneous opportunity sources without deciding whether to
 * trade, bet, mine, transfer, deposit, or withdraw. All candidates continue
 * through the existing risk/allocation gate before a CONSIDER alert.
 */
export function buildUnifiedOpportunityFeed(
  candidates: UnifiedOpportunity[],
  observedAt: string,
): OpportunityFeed {
  const normalized = candidates
    .filter((candidate) => candidate.id && candidate.instrument && candidate.domain)
    .map((candidate) => ({
      ...candidate,
      confidence: clamp01(candidate.confidence),
      metadata: { ...candidate.metadata },
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return { observedAt, opportunities: normalized };
}

export function sourceForDomain(domain: CapitalDomain): OpportunitySource {
  switch (domain) {
    case 'forex': return 'forex';
    case 'crypto': return 'crypto';
    case 'sports': return 'sports';
    default: return 'market';
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
