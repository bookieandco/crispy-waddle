import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { AdAsset } from '../creative/ad-asset.js';

export type AdChannel = 'meta' | 'google' | 'x' | 'amazon' | 'ctv';

export interface ChannelCampaign {
  id: GrowthId;
  externalId?: string;
  name: string;
  channel: AdChannel;
  status: 'draft' | 'active' | 'paused' | 'archived';
}

export interface DeliveryMetrics {
  campaignId: GrowthId;
  channel: AdChannel;
  fetchedAt: ISODateTime;
  impressions: number;
  clicks: number;
  spend: number;
  conversions?: number;
  currency: string;
}

export interface ChannelAdapter {
  readonly channel: AdChannel;
  validateAsset(asset: AdAsset): Promise<{ valid: boolean; reasons: string[] }>;
  createCampaign(input: { name: string }): Promise<ChannelCampaign>;
  publishAsset(campaignId: GrowthId, asset: AdAsset): Promise<{ externalId: string }>;
  fetchDelivery(campaignId: GrowthId): Promise<DeliveryMetrics>;
  pauseCampaign(campaignId: GrowthId): Promise<void>;
}

export interface ChannelExecutionRequest {
  requestId: GrowthId;
  channel: AdChannel;
  campaignId: GrowthId;
  assetId: GrowthId;
  approved: boolean;
  approvedAt?: ISODateTime;
  policyDecisionId?: GrowthId;
}

export function assertExecutionApproved(request: ChannelExecutionRequest): void {
  if (!request.approved || !request.policyDecisionId || !request.approvedAt) {
    throw new Error('Advertising execution requires an explicit policy approval decision.');
  }
}
