import type { GrowthId } from '../domain/types.js';
import type { ChannelDeliveryMetrics } from './channel-registry.js';

export interface InternalDeliveryRecord {
  campaignId: GrowthId;
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
}

export interface DeliveryReconciliation {
  campaignId: GrowthId;
  status: 'matched' | 'variance';
  impressionsDelta: number;
  clicksDelta: number;
  spendDelta: number;
  spendVarianceRate: number;
  currency: string;
}

export function reconcileDelivery(
  platform: ChannelDeliveryMetrics,
  internal: InternalDeliveryRecord,
  varianceTolerance = 0.01,
): DeliveryReconciliation {
  if (platform.currency !== internal.currency) {
    throw new Error(`Currency mismatch: platform=${platform.currency}, internal=${internal.currency}`);
  }

  const spendDelta = platform.spend - internal.spend;
  const spendVarianceRate = internal.spend === 0
    ? Math.abs(platform.spend) > 0 ? 1 : 0
    : Math.abs(spendDelta) / Math.abs(internal.spend);

  return {
    campaignId: internal.campaignId,
    status: spendVarianceRate <= varianceTolerance &&
      platform.impressions === internal.impressions &&
      platform.clicks === internal.clicks ? 'matched' : 'variance',
    impressionsDelta: platform.impressions - internal.impressions,
    clicksDelta: platform.clicks - internal.clicks,
    spendDelta,
    spendVarianceRate,
    currency: platform.currency,
  };
}
