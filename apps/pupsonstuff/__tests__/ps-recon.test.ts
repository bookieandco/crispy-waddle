import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { hotspots } from '../data/hotspots';
import { backgroundRemovalConfigured } from '../lib/background-removal';
import { passedPrintQualityGate } from '../lib/checkout-readiness';
import { ensureSourceResolution, upscalerConfigured } from '../lib/image-upscale';
import { buildPrintMaster, resolveProductPrintProfile } from '../lib/print-master';
import { normalizeArtworkTransform } from '../types/creative';

describe('PS-RECON creative and print contracts', () => {
  it('normalizes artwork transforms into the printable interaction bounds', () => {
    expect(
      normalizeArtworkTransform({ x: 2, y: -1, scale: 9, rotation: 500 })
    ).toEqual({ x: 1, y: 0, scale: 2, rotation: 180 });
  });

  it('binds a quality gate to the exact storefront product and variant', () => {
    const gate = {
      productionReady: true,
      score: 100,
      profile: { productId: 'mugWhite', variantId: 'mug-11oz' },
    };
    expect(passedPrintQualityGate(gate, 'mugWhite', 'mug-11oz')).toBe(true);
    expect(passedPrintQualityGate(gate, 'mugColorful', 'mug-11oz')).toBe(false);
    expect(passedPrintQualityGate(gate, 'mugWhite', 'other')).toBe(false);
  });

  it('recognizes either self-hosted or Knockout-compatible preprocessing', () => {
    expect(
      backgroundRemovalConfigured({
        NODE_ENV: 'test',
        PUPSON_BACKGROUND_REMOVER_URL: 'https://background.example',
      } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(
      backgroundRemovalConfigured({ NODE_ENV: 'test', KNOCKOUT_TOKEN: 'token' } as NodeJS.ProcessEnv)
    ).toBe(true);
    expect(upscalerConfigured({ NODE_ENV: 'test', PUPSON_UPSCALER_URL: 'https://upscale.example' } as NodeJS.ProcessEnv)).toBe(
      true
    );
  });

  it('refuses to invent print detail when no AI upscaler is configured', async () => {
    const bytes = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 1, g: 1, b: 1, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    await expect(
      ensureSourceResolution({
        bytes,
        mimeType: 'image/png',
        requiredWidth: 1200,
        requiredHeight: 1200,
        env: { NODE_ENV: 'test' } as NodeJS.ProcessEnv,
      })
    ).rejects.toThrow(/Configure PUPSON_UPSCALER_URL or KNOCKOUT_TOKEN/);
  });

  it('builds and certifies a product-specific print master from sufficient source detail', async () => {
    const hotspot = hotspots.find((item) => item.id === 'frame1')!;
    const variant = hotspot.fulfillment!.variants[0];
    const profile = resolveProductPrintProfile(hotspot, variant.variantId);
    expect(profile.productId).toBe('frame1');
    expect(profile.variantId).toBe('canvas-12x16');

    const bytes = await sharp({
      create: {
        width: 2400,
        height: 3200,
        channels: 4,
        background: { r: 100, g: 120, b: 140, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const master = await buildPrintMaster({
      generatedBytes: bytes,
      hotspot,
      variantId: variant.variantId,
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
    });
    expect(master.profile.variantId).toBe(variant.variantId);
    expect(master.quality.productionReady).toBe(true);
    expect(master.quality.checks.find((check) => check.id === 'source-resolution')?.status).toBe(
      'pass'
    );
  });
});
