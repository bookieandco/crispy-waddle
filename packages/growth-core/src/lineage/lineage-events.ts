import type { GrowthEvent } from '../events/event-contract.js';
import type { Asset, Campaign, CreativeConcept, GrowthId } from '../domain/types.js';

export interface LineageIndex {
  creativeToAssets: Map<GrowthId, Set<GrowthId>>;
  creativeToCampaigns: Map<GrowthId, Set<GrowthId>>;
}

export function createLineageIndex(): LineageIndex {
  return {
    creativeToAssets: new Map(),
    creativeToCampaigns: new Map(),
  };
}

function add(index: Map<GrowthId, Set<GrowthId>>, source: GrowthId, target: GrowthId): void {
  const targets = index.get(source) ?? new Set<GrowthId>();
  targets.add(target);
  index.set(source, targets);
}

export function applyLineageEvent(index: LineageIndex, event: GrowthEvent): void {
  if (event.eventType === 'asset_created') {
    const asset = event.payload as Partial<Asset>;
    if (asset.creativeConceptId) add(index.creativeToAssets, asset.creativeConceptId, event.entityId);
  }

  if (event.eventType === 'campaign_created') {
    const campaign = event.payload as Partial<Campaign>;
    for (const creativeId of campaign.creativeIds ?? []) {
      add(index.creativeToCampaigns, creativeId, event.entityId);
    }
  }

  if (event.eventType === 'creative_created') {
    const creative = event.payload as Partial<CreativeConcept>;
    if (creative.campaignId) add(index.creativeToCampaigns, event.entityId, creative.campaignId);
  }
}
