import type { GrowthId } from '../domain/types.js';
import type { CreativeBrief } from './creative-brief.js';

export type AdAssetType = 'video' | 'image' | 'carousel' | 'copy';
export type AdAssetStatus = 'draft' | 'ready' | 'approved' | 'archived';

export interface AdAsset {
  id: GrowthId;
  briefId: GrowthId;
  type: AdAssetType;
  title: string;
  version: number;
  status: AdAssetStatus;
  sourceProvider?: string;
  sourceAssetId?: GrowthId;
  campaignId?: GrowthId;
  channelId?: GrowthId;
  creativeConceptId?: GrowthId;
  metadata: Record<string, unknown>;
}

export interface AdVariantPackage {
  id: GrowthId;
  briefId: GrowthId;
  assets: AdAsset[];
  hypothesis: string;
  evidenceEventIds: GrowthId[];
}

export function packageAdAssets(
  brief: CreativeBrief,
  assets: readonly AdAsset[],
): AdVariantPackage {
  const matching = assets.filter((asset) => asset.briefId === brief.id);

  return {
    id: `ad-package:${brief.id}`,
    briefId: brief.id,
    assets: matching.map((asset) => ({ ...asset })),
    hypothesis: brief.hypothesis,
    evidenceEventIds: [...brief.evidenceEventIds],
  };
}
