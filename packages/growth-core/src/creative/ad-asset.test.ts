import { describe, expect, it } from 'vitest';
import { packageAdAssets } from './ad-asset.js';
import type { CreativeBrief } from './creative-brief.js';
import type { AdAsset } from './ad-asset.js';

const brief: CreativeBrief = {
  id: 'brief-1',
  objective: 'Acquire profitable customers',
  audience: 'new customers',
  offer: 'starter offer',
  hook: 'problem-first',
  format: 'UGC demo',
  channel: 'meta',
  hypothesis: 'Problem-first demo increases profitable conversions',
  rationale: 'Validated experiment evidence supports the format.',
  supportingLearningIds: ['learning:exp-1'],
  evidenceEventIds: ['event-1'],
  status: 'draft',
};

const assets: AdAsset[] = [
  {
    id: 'asset-video-1',
    briefId: 'brief-1',
    type: 'video',
    title: 'Problem-first UGC demo',
    version: 1,
    status: 'ready',
    sourceProvider: 'creative-center',
    sourceAssetId: 'video-1',
    creativeConceptId: 'creative-1',
    metadata: { durationSeconds: 30 },
  },
  {
    id: 'asset-other',
    briefId: 'brief-2',
    type: 'image',
    title: 'Unrelated asset',
    version: 1,
    status: 'draft',
    metadata: {},
  },
];

describe('ad asset production bridge', () => {
  it('packages only assets generated for the brief and preserves evidence lineage', () => {
    const result = packageAdAssets(brief, assets);

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].id).toBe('asset-video-1');
    expect(result.hypothesis).toBe(brief.hypothesis);
    expect(result.evidenceEventIds).toEqual(['event-1']);
  });
});
