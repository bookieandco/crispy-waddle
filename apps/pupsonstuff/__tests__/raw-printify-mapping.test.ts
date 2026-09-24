import { describe, expect, it } from 'vitest';
import { validateStripeLineItems } from '../lib/catalog';

function rawBlueprintLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'li_raw_1',
    productId: 'frame1',
    variantId: 'canvas-12x16',
    artStyle: 'astronaut',
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
    ...overrides,
  };
}

describe('raw Printify blueprint catalog snapshots', () => {
  it('accepts a signed Stripe line without a shop product id', () => {
    const items = validateStripeLineItems([rawBlueprintLine()]);
    expect(items).toHaveLength(1);
    expect(items?.[0]).toMatchObject({
      productId: 'frame1',
      variantId: 'canvas-12x16',
      fulfillmentProvider: 'printify',
      providerVariantId: '12345',
      blueprintId: '678',
      printProviderId: '90',
      printArea: 'front',
    });
    expect(items?.[0].providerProductId).toBeUndefined();
  });

  it('preserves a real shop product id when one exists', () => {
    const items = validateStripeLineItems([
      rawBlueprintLine({ providerProductId: 'printify-shop-product-1' }),
    ]);
    expect(items?.[0].providerProductId).toBe('printify-shop-product-1');
  });

  it('still rejects an invalid provider product metadata type', () => {
    expect(
      validateStripeLineItems([rawBlueprintLine({ providerProductId: 42 })])
    ).toBeNull();
  });

  it('still requires the blueprint, provider variant, print provider and print area', () => {
    for (const key of ['providerVariantId', 'blueprintId', 'printProviderId', 'printArea']) {
      expect(validateStripeLineItems([rawBlueprintLine({ [key]: undefined })])).toBeNull();
    }
  });
});
