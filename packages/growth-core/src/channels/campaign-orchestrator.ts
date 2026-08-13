import type { AdAsset } from '../creative/ad-asset.js';
import type { GrowthId } from '../domain/types.js';
import { ChannelRegistry, type AdvertisingChannel } from './channel-registry.js';

export interface CampaignApproval {
  approved: boolean;
  approvedAt?: string;
  policyDecisionId?: GrowthId;
}

export interface CampaignExecutionRequest {
  channel: AdvertisingChannel;
  campaignId: GrowthId;
  name: string;
  objective: string;
  asset: AdAsset;
  approval: CampaignApproval;
}

export interface CampaignExecutionResult {
  campaignId: GrowthId;
  channel: AdvertisingChannel;
  externalCampaignId: string;
  executedAt: string;
  policyDecisionId: GrowthId;
}

export class CampaignExecutionOrchestrator {
  constructor(private readonly registry: ChannelRegistry) {}

  async execute(request: CampaignExecutionRequest): Promise<CampaignExecutionResult> {
    const { approval } = request;
    if (!approval.approved || !approval.approvedAt || !approval.policyDecisionId) {
      throw new Error('Campaign execution requires approval, approval timestamp, and policy decision');
    }

    const adapter = this.registry.get(request.channel);
    await adapter.validateAsset(request.asset);
    const { externalCampaignId } = await adapter.createCampaign({
      campaignId: request.campaignId,
      name: request.name,
      objective: request.objective,
      asset: request.asset,
    });

    return {
      campaignId: request.campaignId,
      channel: request.channel,
      externalCampaignId,
      executedAt: new Date().toISOString(),
      policyDecisionId: approval.policyDecisionId,
    };
  }
}
