import { describe, expect, it } from 'vitest';
import type { PrintifyCatalogVariant } from '../lib/printify';
import {
  buildLaunchTargets,
  launchVariantMatches,
  type LaunchTarget,
} from '../scripts/printify-catalog-sync';

function variant(
  id: number,
  title: string,
  options: { size?: string; color?: string }
): PrintifyCatalogVariant {
  return {
    id,
    title,
    options,
    placeholders: [
      {
        position: 'front',
        decoration_method: 'dtg',
        height: 1000,
        width: 1000,
      },
    ],
    decoration_methods: ['dtg'],
  };
}

function target(productId: string): LaunchTarget {
  const found = buildLaunchTargets().find((entry) => entry.productId === productId);
  if (!found) throw new Error(`Missing launch target ${productId}`);
  return found;
}

describe('Printify exact launch candidate matching', () => {
  it('builds exactly the governed three-SKU launch matrix', () => {
    expect(
      buildLaunchTargets().map(({ productId, variantId }) => ({ productId, variantId }))
    ).toEqual([
      { productId: 'frame1', variantId: 'canvas-12x16' },
      { productId: 'mugWhite', variantId: 'mug-11oz' },
      { productId: 'concertShirt', variantId: 'tee-concert-m' },
    ]);
  });

  it('matches the 11oz white mug and rejects a 15oz white mug', () => {
    const mug = target('mugWhite');
    expect(launchVariantMatches(mug, variant(1, 'White / 11oz', { size: '11 oz', color: 'White' }))).toBe(
      true
    );
    expect(launchVariantMatches(mug, variant(2, 'White / 15oz', { size: '15 oz', color: 'White' }))).toBe(
      false
    );
  });

  it('can use a numeric title when Printify omits the structured size option', () => {
    const mug = target('mugWhite');
    expect(launchVariantMatches(mug, variant(3, 'Classic White Mug 11oz', { color: 'White' }))).toBe(
      true
    );
  });

  it('requires both medium size and black color for the concert tee', () => {
    const tee = target('concertShirt');
    expect(launchVariantMatches(tee, variant(10, 'Black / M', { size: 'M', color: 'Black' }))).toBe(
      true
    );
    expect(launchVariantMatches(tee, variant(11, 'Black / L', { size: 'L', color: 'Black' }))).toBe(
      false
    );
    expect(launchVariantMatches(tee, variant(12, 'White / M', { size: 'M', color: 'White' }))).toBe(
      false
    );
  });

  it('matches the exact 12×16 canvas dimensions', () => {
    const canvas = target('frame1');
    expect(
      launchVariantMatches(canvas, variant(20, '12 x 16', { size: '12″ x 16″' }))
    ).toBe(true);
    expect(
      launchVariantMatches(canvas, variant(21, '16 x 20', { size: '16″ x 20″' }))
    ).toBe(false);
    expect(
      launchVariantMatches(canvas, variant(22, 'Gallery Canvas 12 x 16', {}))
    ).toBe(true);
  });
});
