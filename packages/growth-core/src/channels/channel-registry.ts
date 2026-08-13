import type { AdAsset } from '../creative/ad-asset.js';
import type { GrowthId } from '../domain/types.js';

export type AdvertisingChannel = 'meta' | 'google' | 'x' | 'amazon' | 'ctv';

export interface ChannelCampaignRequest {
  campaignId: GrowthId;
  name: string;
  objective: string;
  asset: AdAsset;
}

export interface ChannelDeliveryMetrics {
  campaignId: GrowthId;
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
}

export interface ChannelAdapter {
  readonly channel: AdvertisingChannel;
  validateAsset(asset: AdAsset): Promise<void>;
  createCampaign(request: ChannelCampaignRequest): Promise<{ externalCampaignId: string }>;
  fetchMetrics(externalCampaignId: string): Promise<ChannelDeliveryMetrics>;
  pauseCampaign(externalCampaignId: string): Promise<void>;
}

export class ChannelRegistry {
  private readonly adapters = new Map<AdvertisingChannel, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  get(channel: AdvertisingChannel): ChannelAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) throw new Error(`No advertising adapter registered for ${channel}`);
    return adapter;
  }
}

export class MockChannelAdapter implements ChannelAdapter {
  readonly channel: AdvertisingChannel;
  private readonly campaigns = new Map<string, ChannelDeliveryMetrics>();

  constructor(channel: AdvertisingChannel) {
    this.channel = channel;
  }

  async validateAsset(asset: AdAsset): Promise<void> {
    if (asset.status !== 'ready' && asset.status !== 'approved') {
      throw new Error(`Asset ${asset.id} is not ready for ${this.channel}`);
    }
  }

  async createCampaign(request: ChannelCampaignRequest): Promise<{ externalCampaignId: string }> {
    await this.validateAsset(request.asset);
    const externalCampaignId = `${this.channel}:${request.campaignId}`;
    this.campaigns.set(externalCampaignId, {
      campaignId: request.campaignId,
      impressions: 0,
      clicks: 0,
      spend: 0,
      currency: 'USD',
    });
    return { externalCampaignId };
  }

  async fetchMetrics(externalCampaignId: string): Promise<ChannelDeliveryMetrics> {
    const metrics = this.campaigns.get(externalCampaignId);
    if (!metrics) throw new Error(`Unknown campaign ${externalCampaignId}`);
    return { ...metrics };
  }

  async pauseCampaign(externalCampaignId: string): Promise<void> {
    if (!this.campaigns.has(externalCampaignId)) throw new Error(`Unknown campaign ${externalCampaignId}`);
  }
}
