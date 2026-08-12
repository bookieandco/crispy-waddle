import type { GrowthId } from '../domain/types.js';
import type { PerformanceAggregate } from '../attribution/performance-aggregator.js';

export type GrowthAction = 'scale' | 'test' | 'hold' | 'reduce' | 'stop';

export interface GrowthDecision {
  id: GrowthId;
  key: string;
  action: GrowthAction;
  rationale: string;
  confidence: number;
  evidence: {
    revenue: number;
    contributionMargin: number;
    spend: number;
    roas: number;
    contributionRoas: number;
    cac: number;
    customers: number;
  };
}

export function buildGrowthDecisionFeed(
  aggregates: readonly PerformanceAggregate[],
  thresholds = { scaleContributionRoas: 2, reduceContributionRoas: 0.75, minCustomers: 2 },
): GrowthDecision[] {
  return aggregates.map((item) => {
    let action: GrowthAction = 'test';
    if (item.customers < thresholds.minCustomers) action = 'test';
    else if (item.contributionRoas >= thresholds.scaleContributionRoas) action = 'scale';
    else if (item.contributionRoas <= 0) action = 'stop';
    else if (item.contributionRoas < thresholds.reduceContributionRoas) action = 'reduce';
    else action = 'hold';

    const confidence = Math.min(1, item.customers / Math.max(thresholds.minCustomers * 4, 1));
    return {
      id: `decision:${item.key}`,
      key: item.key,
      action,
      rationale: `${action.toUpperCase()}: contribution ROAS=${item.contributionRoas.toFixed(2)}, customers=${item.customers}, CAC=${item.cac.toFixed(2)}.`,
      confidence,
      evidence: {
        revenue: item.revenue,
        contributionMargin: item.contributionMargin,
        spend: item.spend,
        roas: item.roas,
        contributionRoas: item.contributionRoas,
        cac: item.cac,
        customers: item.customers,
      },
    };
  });
}
