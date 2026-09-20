import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rest: vi.fn(),
  createSignedAssetUrl: vi.fn(),
  submitOrder: vi.fn(),
  uploadImage: vi.fn(),
  getOrder: vi.fn(),
}));
const { rest, createSignedAssetUrl, submitOrder, uploadImage, getOrder } = mocks;

vi.mock('@/lib/platform', () => ({
  rest: mocks.rest,
  createSignedAssetUrl: mocks.createSignedAssetUrl,
}));
vi.mock('@/lib/printify', () => ({
  submitOrder: mocks.submitOrder,
  uploadImage: mocks.uploadImage,
  getOrder: mocks.getOrder,
}));

import { queueFulfillment, submitFulfillment } from '../lib/fulfillment-bridge';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PUPSON_FULFILLMENT_MODE', 'dry_run');
});

afterEach(() => vi.unstubAllEnvs());

describe('PupsonStuff fulfillment safety', () => {
  it('reuses the existing fulfillment row when an idempotent queue insert is ignored', async () => {
    rest.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'fulfillment-existing' }]);

    await expect(queueFulfillment('order-1')).resolves.toBe('fulfillment-existing');
    expect(rest).toHaveBeenNthCalledWith(
      2,
      'pupson_fulfillment_orders?select=id&order_id=eq.order-1&limit=1'
    );
  });

  it('records a dry-run event without uploading artwork or buying production', async () => {
    rest.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('pupson_fulfillment_orders?select=*'))
        return [
          {
            id: 'fulfillment-1',
            order_id: 'order-1',
            status: 'pending',
            attempt_count: 0,
            provider: 'printify',
          },
        ];
      if (path.startsWith('pupson_orders?select='))
        return [
          {
            id: 'order-1',
            customer_email: 'customer@example.invalid',
            customer_name: 'Test Customer',
            customer_phone: null,
            shipping_address: {
              line1: '1 Test Way',
              city: 'Portland',
              state: 'OR',
              postal_code: '97035',
              country: 'US',
            },
          },
        ];
      if (path.startsWith('pupson_order_items?select='))
        return [
          {
            id: 'line-1',
            quantity: 1,
            fulfillment_provider: 'printify',
            fulfillment_product_id: 'product-1',
            fulfillment_variant_id: 'variant-1',
            catalog_snapshot: {
              blueprint_id: '1',
              print_provider_id: '2',
              print_area: 'front',
            },
            print_asset: { bucket_id: 'pupson-print-ready', object_path: 'print.png' },
          },
        ];
      if (init?.method === 'PATCH' || init?.method === 'POST') return undefined;
      throw new Error(`Unexpected REST call: ${path}`);
    });

    await expect(submitFulfillment('fulfillment-1')).resolves.toEqual({ status: 'blocked' });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(submitOrder).not.toHaveBeenCalled();
    expect(createSignedAssetUrl).not.toHaveBeenCalled();
    expect(rest).toHaveBeenCalledWith(
      'pupson_fulfillment_events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          fulfillment_order_id: 'fulfillment-1',
          event_type: 'dry_run_validated',
          payload: { itemCount: 1 },
        }),
      })
    );
  });

  it('refuses live submission when the shop identity is missing', async () => {
    vi.stubEnv('PUPSON_FULFILLMENT_MODE', 'live');
    vi.stubEnv('PRINTIFY_SHOP_ID', '');
    rest.mockImplementation(async (path: string) => {
      if (path.startsWith('pupson_fulfillment_orders?select=*'))
        return [
          {
            id: 'fulfillment-1',
            order_id: 'order-1',
            status: 'pending',
            attempt_count: 0,
            provider: 'printify',
          },
        ];
      if (path.startsWith('pupson_orders?select='))
        return [
          {
            id: 'order-1',
            customer_email: 'customer@example.invalid',
            customer_name: 'Test Customer',
            customer_phone: null,
            shipping_address: {},
          },
        ];
      if (path.startsWith('pupson_order_items?select='))
        return [
          {
            id: 'line-1',
            quantity: 1,
            fulfillment_provider: 'printify',
            fulfillment_product_id: 'product-1',
            fulfillment_variant_id: 'variant-1',
            catalog_snapshot: {},
            print_asset: { bucket_id: 'pupson-print-ready', object_path: 'print.png' },
          },
        ];
      throw new Error(`Unexpected REST call: ${path}`);
    });

    await expect(submitFulfillment('fulfillment-1')).rejects.toThrow(
      'PRINTIFY_SHOP_ID is not configured.'
    );
    expect(submitOrder).not.toHaveBeenCalled();
  });
});
