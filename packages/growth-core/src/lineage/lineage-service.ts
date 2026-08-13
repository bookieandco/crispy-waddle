import type { Asset, Campaign, CreativeConcept, GrowthId } from '../domain/types.js';

export interface GrowthLineage {
  creativeConcept?: CreativeConcept;
  assets: Asset[];
  campaigns: Campaign[];
}

export class GrowthLineageService {
  constructor(
    private readonly concepts: readonly CreativeConcept[],
    private readonly assets: readonly Asset[],
    private readonly campaigns: readonly Campaign[],
  ) {}

  forCreative(creativeId: GrowthId): GrowthLineage {
    const creativeConcept = this.concepts.find((item) => item.id === creativeId);
    const assets = this.assets.filter((item) => item.creativeConceptId === creativeId);
    const campaignIds = new Set<string>();

    if (creativeConcept?.campaignId) campaignIds.add(creativeConcept.campaignId);
    for (const asset of assets) {
      const campaign = this.campaigns.find((item) => item.creativeIds.includes(asset.creativeConceptId));
      if (campaign) campaignIds.add(campaign.id);
    }

    return {
      creativeConcept,
      assets,
      campaigns: this.campaigns.filter((campaign) => campaignIds.has(campaign.id)),
    };
  }
}
