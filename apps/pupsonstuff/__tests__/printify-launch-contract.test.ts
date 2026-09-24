import { describe, expect, it } from 'vitest';

import {
  buildFulfillmentGroups,
  matchVariants,
} from '../scripts/printify-catalog-sync';
import { validateStripeLineItems } from '../lib/catalog';

describe('Printify launch discovery', () => {
  it('derives the 11oz mug size from fulfillment variant labels', () => {
    const mug = buildFulfillmentGroups().find(
      (group) => group.fulfillmentProductId === 'mug'
    );

    expect(mug).toBeDefined();
    expect(mug?.sizes).toContain('11oz');
    expect(mug?.colors).toContain('White');
  });

  it('does not accept a 15oz white mug for the 11oz launch target', () => {
    const mug = buildFulfillmentGroups().find(
      (group) => group.fulfillmentProductId === 'mug'
    );
    expect(mug).toBeDefined();

    const result = matchVariants(mug!, [
      {
        id: 1500,
        title: 'White / 15oz',
        options: { size: '15oz', color: 'White' },
        placeholders: [
          {
            position: 'wrap',
            decoration_method: 'sublimation',
            height: 100,
            width: 100,
          },
        ],
        decoration_methods: ['sublimation'],
      },
      {
        id: 1100,
        title: 'White / 11oz',
        options: { size: '11oz', color: 'White' },
        placeholders: [
          {
            position: 'wrap',
            decoration_method: 'sublimation',
            height: 100,
            width: 100,
          },
        ],
        decoration_methods: ['sublimation'],
      },
    ]);

    expect(result.unmatched).toEqual([]);
    expect(result.matched).toEqual([
      {
        dimension: 'Size: 11oz, Color: White',
        printifyVariantId: 1100,
        printifyVariantTitle: 'White / 11oz',
      },
    ]);
  });
});

describe('raw-blueprint checkout snapshots', () => {
  it('accepts a certified Printify mapping with no shop product ID', () => {
    const items = validateStripeLineItems([
      {
        id: 'li_test',
        productId: 'frame1',
        variantId: 'canvas-12x16',
        artStyle: 'watercolor',
        creativeOutputId: 'output-1',
        printAssetId: 'asset-1',
        fulfillmentProvider: 'printify',
        providerVariantId: '12345',
        blueprintId: '678',
        printProviderId: '90',
        printArea: 'front',
        catalogCertificationStatus: 'sandbox_verified',
        productName: 'Astronaut Portrait Canvas',
        price: 6900,
        quantity: 1,
      },
    ]);

    expect(items).not.toBeNull();
    expect(items?.[0]).toMatchObject({
      providerVariantId: '12345',
      blueprintId: '678',
      printProviderId: '90',
    });
    expect(items?.[0].providerProductId).toBeUndefined();
  });
});
