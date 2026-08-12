import type { GrowthId } from '../domain/types.js';
import type { AttributionResult } from '../attribution/attribution-engine.js';

export interface EconomicOrder {
  orderId: GrowthId;
  revenue: number;
  refunds: number;
  variableCosts: number;
  currency: string;
}

export interface EconomicAttribution {
  conversionId: GrowthId;
  model: AttributionResult['model'];
  currency: string;
  totalRevenue: number;
  totalRefunds: number;
  totalVariableCosts: number;
  contributionMargin: number;
  credits: Array<{
    touchpointId: GrowthId;
    campaignId?: GrowthId;
    creativeId?: GrowthId;
    channelId?: GrowthId;
    credit: number;
    attributedRevenue: number;
    attributedContributionMargin: number;
  }>;
}

export function calculateEconomicAttribution(
  attribution: AttributionResult,
  order: EconomicOrder,
): EconomicAttribution {
  const contributionMargin = order.revenue - order.refunds - order.variableCosts;

  return {
    conversionId: attribution.conversionId,
    model: attribution.model,
    currency: order.currency,
    totalRevenue: order.revenue,
    totalRefunds: order.refunds,
    totalVariableCosts: order.variableCosts,
    contributionMargin,
    credits: attribution.credits.map((credit) => ({
      ...credit,
      attributedRevenue: order.revenue * credit.credit,
      attributedContributionMargin: contributionMargin * credit.credit,
    })),
  };
}
