import { deployableCapital, rankOpportunities, recommendTreasury } from './allocator';
import { snapshotToCapitalPositions, type CapitalLabSnapshotLike } from './snapshot';
import type { Opportunity } from './domain';

export type CapitalIntelligenceSnapshot = {
  deployableCapital: { amount: number; currency: string };
  positions: ReturnType<typeof snapshotToCapitalPositions>;
  treasuryRecommendations: ReturnType<typeof recommendTreasury>;
  rankedOpportunities: Opportunity[];
};

/**
 * Read-only orchestration boundary. It never places orders or moves money.
 */
export function buildCapitalIntelligenceSnapshot(
  capitalLab: CapitalLabSnapshotLike,
  opportunities: Opportunity[] = [],
): CapitalIntelligenceSnapshot {
  const positions = snapshotToCapitalPositions(capitalLab);
  return {
    deployableCapital: deployableCapital(positions),
    positions,
    treasuryRecommendations: recommendTreasury(positions),
    rankedOpportunities: rankOpportunities(opportunities),
  };
}
