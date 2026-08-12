import type { GrowthId } from '../domain/types.js';
import type { AttributionCredit } from './attribution-model.js';

export interface PerformanceInput {
  credit: AttributionCredit;
  spend: number;
  contributionMargin: number;
  customerLtv?: number;
}

export interface PerformanceAggregate {
  key: string;
  revenue: number;
  contributionMargin: number;
  spend: number;
  customers: number;
  ltv: number;
  roas: number;
  contributionRoas: number;
  cac: number;
}

export function aggregatePerformance(inputs: readonly PerformanceInput[], dimension: 'creative' | 'audience' | 'offer' | 'channel' = 'creative'): PerformanceAggregate[] {
  const groups = new Map<string, PerformanceAggregate>();
  for (const input of inputs) {
    const key = dimension === 'creative' ? input.credit.creativeConceptId
      : dimension === 'audience' ? input.credit.audienceId
      : dimension === 'offer' ? input.credit.offerId
      : input.credit.model;
    if (!key) continue;
    const current = groups.get(key) ?? { key, revenue: 0, contributionMargin: 0, spend: 0, customers: 0, ltv: 0, roas: 0, contributionRoas: 0, cac: 0 };
    current.revenue += input.credit.attributedRevenue;
    current.contributionMargin += input.contributionMargin;
    current.spend += input.spend;
    current.customers += 1;
    current.ltv += input.customerLtv ?? 0;
    groups.set(key, current);
  }
  return [...groups.values()].map((result) => ({
    ...result,
    roas: result.spend === 0 ? 0 : result.revenue / result.spend,
    contributionRoas: result.spend === 0 ? 0 : result.contributionMargin / result.spend,
    cac: result.customers === 0 ? 0 : result.spend / result.customers,
  }));
}
