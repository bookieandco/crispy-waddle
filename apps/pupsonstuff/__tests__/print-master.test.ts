import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { hotspots } from '../data/hotspots';
import { buildPrintMaster, resolveProductPrintProfile } from '../lib/print-master';

async function squarePng(size = 1024): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 120, g: 80, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe('product-specific print master', () => {
  it('builds a 12x16 apparel master at target DPI and records placement', async () => {
    const product = hotspots.find((item) => item.id === 'concertShirt')!;
    const result = await buildPrintMaster({
      generatedBytes: await squarePng(2048),
      hotspot: product,
      variantId: 'FUL-TEE-CONCERT-M',
      transform: { x: 0.5, y: 0.45, scale: 1.2, rotation: 8 },
    });
    expect(result.width).toBe(3600);
    expect(result.height).toBe(4800);
    expect(result.profile.variantId).toBe('FUL-TEE-CONCERT-M');
    expect(result.transform).toMatchObject({ x: 0.5, y: 0.45, scale: 1.2, rotation: 8 });
    expect(result.quality.productionReady).toBe(true);
    expect(result.quality.score).toBeGreaterThanOrEqual(90);
  });

  it('fails closed when an enlarged placement needs an upscaler that is not configured', async () => {
    const product = hotspots.find((item) => item.id === 'concertShirt')!;
    await expect(
      buildPrintMaster({
        generatedBytes: await squarePng(512),
        hotspot: product,
        variantId: 'FUL-TEE-CONCERT-M',
        transform: { x: 0.5, y: 0.5, scale: 2, rotation: 0 },
      })
    ).rejects.toThrow('Configure PUPSON_UPSCALER_URL or KNOCKOUT_TOKEN');
  });

  it('uses variant dimensions for canvas products', () => {
    const product = hotspots.find((item) => item.id === 'frame1')!;
    const profile = resolveProductPrintProfile(product, 'FUL-CANVAS-16x20');
    expect(profile.printWidthInches).toBe(16);
    expect(profile.printHeightInches).toBe(20);
    expect(profile.targetDpi).toBe(300);
  });
});
