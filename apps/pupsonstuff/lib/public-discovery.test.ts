import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatformConfig: vi.fn(),
  rest: vi.fn(),
}));

vi.mock('@/lib/platform', () => ({
  getPlatformConfig: mocks.getPlatformConfig,
  rest: mocks.rest,
}));

import {
  buildPupsonDiscoveryManifest,
  loadPublicCatalogProducts,
} from './public-discovery';

describe('PupsonStuff public discovery catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformConfig.mockReturnValue(null);
    mocks.rest.mockResolvedValue([]);
  });

  it('keeps sellability unknown when the live catalog ledger is unavailable', async () => {
    const products = await loadPublicCatalogProducts('https://pupsonstuff.example');
    const frame = products.find((product) => product.id === 'frame1')!;

    expect(frame.sellability).toBe('unknown');
    expect(frame.variants.every((variant) => variant.sellability === 'unknown')).toBe(true);
    expect(frame.canonicalUrl).toBe('https://pupsonstuff.example/products/frame1');
    expect(frame.markdownUrl).toBe('https://pupsonstuff.example/products/frame1/page.md');
    expect(mocks.rest).not.toHaveBeenCalled();
  });

  it('reports checkout mapping certification without converting it into inventory', async () => {
    mocks.getPlatformConfig.mockReturnValue({ url: 'https://db.example', serviceKey: 'secret' });
    mocks.rest.mockResolvedValue([
      { product_id: 'frame1', variant_id: 'canvas-12x16', active: true, certification_status: 'sandbox_verified' },
      { product_id: 'frame1', variant_id: 'canvas-16x20', active: true, certification_status: 'sample_verified' },
      { product_id: 'frame1', variant_id: 'canvas-20x30', active: true, certification_status: 'sample_verified' },
    ]);

    const manifest = await buildPupsonDiscoveryManifest(
      'https://pupsonstuff.example',
      '2026-09-30T08:30:00Z',
    );
    const frame = manifest.entities.find((entity) => entity.id === 'product:frame1')!;

    expect(frame.attributes?.sellability).toBe('certified');
    expect(frame.availability).toBe('unknown');
    expect(frame.price).toEqual({ currency: 'USD', min: 69, max: 129 });
    expect(frame.evidenceRefs).toContain('catalog-certification:frame1:canvas-12x16');
  });

  it('fails closed to unknown sellability when the live ledger query errors', async () => {
    mocks.getPlatformConfig.mockReturnValue({ url: 'https://db.example', serviceKey: 'secret' });
    mocks.rest.mockRejectedValue(new Error('network'));

    const products = await loadPublicCatalogProducts('https://pupsonstuff.example');
    expect(products.every((product) => product.sellability === 'unknown')).toBe(true);
  });
});
