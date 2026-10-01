import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hotspots } from '@/data/hotspots';
import {
  getHotspot3DMapping,
  getProduct3DConfig,
  hotspot3DModels,
} from '@/config/product3dModels';
import { pupsonCreativeComputeDraft } from '@/lib/compute-workload';
import { resolvePupsonCreativeProvider } from '@/lib/creative-provider';

const ROOT = resolve(process.cwd());

function sha(path: string) {
  return createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex');
}

describe('PUPSON-EXPERIENCE convergence', () => {
  it('keeps the canonical boutique photo present', () => {
    expect(readFileSync(resolve(ROOT, 'public/boutique.png')).byteLength).toBeGreaterThan(1_000_000);
  });

  it('maps every sellable boutique hotspot into the product 3D engine', () => {
    for (const hotspot of hotspots.filter((item) => item.fulfillment)) {
      const mapping = getHotspot3DMapping(hotspot.id);
      expect(mapping, hotspot.id).toBeTruthy();
      expect(getProduct3DConfig(mapping!.modelId), hotspot.id).toBeTruthy();
    }
  });

  it('uses a procedural canvas while keeping the six approved GLBs', () => {
    expect(getProduct3DConfig('canvas')?.primitive).toBe('canvas');
    for (const id of ['shirt', 'hoodie', 'mug', 'pillow', 'bottle', 'tote']) {
      expect(getProduct3DConfig(id)?.glbPath).toMatch(/^\/models\/.+\.glb$/);
    }
    expect(Object.keys(hotspot3DModels).length).toBeGreaterThanOrEqual(15);
  });

  it('keeps approved GLBs byte-identical to their public runtime copies', () => {
    const pairs = [
      ['assets/approved/bottle.glb', 'public/models/bottle.glb'],
      ['assets/approved/hoodie.glb', 'public/models/hoodie.glb'],
      ['assets/approved/mug.glb', 'public/models/mug.glb'],
      ['assets/approved/pillow.glb', 'public/models/pillow.glb'],
      ['assets/approved/shirt.glb', 'public/models/shirt_baked.glb'],
      ['assets/approved/tote.glb', 'public/models/tote.glb'],
    ] as const;
    for (const [approved, runtime] of pairs) expect(sha(runtime)).toBe(sha(approved));
  });

  it('routes styles through one provider-neutral creative seam', () => {
    expect(resolvePupsonCreativeProvider('ascii-art').id).toBe('local');
    expect(resolvePupsonCreativeProvider('studio-ghibli').id).toBe('muapi');
    expect(resolvePupsonCreativeProvider('flux-dreamscape').id).toBe('muapi');
    expect(resolvePupsonCreativeProvider('watercolor').id).toBe('openai');
  });

  it('describes Pet Identity generation as sensitive local-first Jhadina compute work', () => {
    const draft = pupsonCreativeComputeDraft({
      jobId: 'job-1',
      idempotencyKey: 'idem-1',
      petIdentityId: 'pet-1',
      productId: 'frame1',
      artStyle: 'watercolor',
      sourceAssetIds: ['asset-1'],
      profileId: 'pupson.image.default',
    });
    expect(draft.source).toBe('pupsonstuff');
    expect(draft.kind).toBe('image-generation');
    expect(draft.constraints?.sensitiveData).toBe(true);
    expect(draft.constraints?.allowCloudBurst).not.toBe(true);
    expect(draft.resourceProfileId).toBe('pupson.image.default');
  });
});
