import { describe, expect, it } from 'vitest';
import { GrowthLineageService } from './lineage-service.js';
import type { Asset, Campaign, CreativeConcept } from '../domain/types.js';

const base = {
  version: 1,
  status: 'active' as const,
  createdAt: '2026-08-12T18:00:00.000Z',
  updatedAt: '2026-08-12T18:00:00.000Z',
  provenance: { source: 'test', actor: 'test' },
};

const concept: CreativeConcept = {
  ...base,
  id: 'creative-1',
  type: 'creative_concept',
  name: 'Demo',
  concept: 'Product demonstration',
  campaignId: 'campaign-1',
};

const asset: Asset = {
  ...base,
  id: 'asset-1',
  type: 'asset',
  name: 'demo.mp4',
  assetKind: 'video',
  creativeConceptId: 'creative-1',
};

const campaign: Campaign = {
  ...base,
  id: 'campaign-1',
  type: 'campaign',
  name: 'Launch',
  objective: 'contribution_margin',
  audienceIds: [],
  offerIds: [],
  creativeIds: ['creative-1'],
  channelIds: ['meta'],
};

describe('GrowthLineageService', () => {
  it('resolves a creative to its assets and campaign', () => {
    const service = new GrowthLineageService([concept], [asset], [campaign]);
    const result = service.forCreative('creative-1');

    expect(result.creativeConcept?.id).toBe('creative-1');
    expect(result.assets.map((item) => item.id)).toEqual(['asset-1']);
    expect(result.campaigns.map((item) => item.id)).toEqual(['campaign-1']);
  });

  it('returns an empty lineage for an unknown creative', () => {
    const service = new GrowthLineageService([concept], [asset], [campaign]);
    const result = service.forCreative('missing');

    expect(result.creativeConcept).toBeUndefined();
    expect(result.assets).toEqual([]);
    expect(result.campaigns).toEqual([]);
  });
});
