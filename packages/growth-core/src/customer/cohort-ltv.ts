import type { GrowthId } from '../domain/types.js';
import type { CustomerOrder } from './customer-value.js';

export interface CohortLtv {
  cohortKey: string;
  customerCount: number;
  orderCount: number;
  revenue: number;
  refunds: number;
  variableCosts: number;
  contributionMargin: number;
  ltvPerCustomer: number;
}

export interface CohortDimensions {
  customerId: GrowthId;
  acquisitionAt: string;
  campaignId?: GrowthId;
  creativeId?: GrowthId;
  audienceId?: GrowthId;
  offerId?: GrowthId;
  channelId?: GrowthId;
}

export function monthCohort(date: string): string {
  return date.slice(0, 7);
}

export function calculateCohortLtv(
  dimensions: readonly CohortDimensions[],
  orders: readonly CustomerOrder[],
  cohortBy: keyof Pick<CohortDimensions, 'campaignId' | 'creativeId' | 'audienceId' | 'offerId' | 'channelId'> | 'acquisitionMonth',
): CohortLtv[] {
  const groups = new Map<string, Set<GrowthId>>();
  const acquisition = new Map<GrowthId, CohortDimensions>();

  for (const dimension of dimensions) {
    acquisition.set(dimension.customerId, dimension);
    const key = cohortBy === 'acquisitionMonth'
      ? monthCohort(dimension.acquisitionAt)
      : dimension[cohortBy] ?? 'unknown';
    const customers = groups.get(key) ?? new Set<GrowthId>();
    customers.add(dimension.customerId);
    groups.set(key, customers);
  }

  return [...groups.entries()].map(([cohortKey, customerIds]) => {
    const cohortOrders = orders.filter((order) => customerIds.has(order.customerId));
    const revenue = cohortOrders.reduce((sum, order) => sum + order.revenue, 0);
    const refunds = cohortOrders.reduce((sum, order) => sum + order.refunds, 0);
    const variableCosts = cohortOrders.reduce((sum, order) => sum + order.variableCosts, 0);
    const contributionMargin = revenue - refunds - variableCosts;

    return {
      cohortKey,
      customerCount: customerIds.size,
      orderCount: cohortOrders.length,
      revenue,
      refunds,
      variableCosts,
      contributionMargin,
      ltvPerCustomer: customerIds.size ? contributionMargin / customerIds.size : 0,
    };
  });
}
