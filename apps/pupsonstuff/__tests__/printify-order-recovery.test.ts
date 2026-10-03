import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOrderByExternalId } from '../lib/printify';

const fetchMock = vi.fn();

function response(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  } as Response;
}

function order(id: string, externalId: string) {
  return {
    id,
    app_order_id: null,
    address_to: {},
    line_items: [],
    total_price: 0,
    total_shipping: 0,
    total_tax: 0,
    status: 'on-hold',
    shipping_method: 1,
    is_printify_express: false,
    is_economy_shipping: false,
    shipments: [],
    created_at: '2026-10-02T20:00:00.000Z',
    sent_to_production_at: null,
    fulfilled_at: null,
    metadata: {
      order_type: 'api',
      shop_order_id: externalId,
      shop_order_label: externalId,
    },
  };
}

beforeEach(() => {
  vi.stubEnv('PRINTIFY_API_KEY', 'printify-test-token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Printify external order recovery', () => {
  it('finds a submitted order by the sales-channel external id across pages', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          current_page: 1,
          data: [order('provider-other', 'other-external-id')],
          last_page: 2,
          next_page_url: 'https://api.printify.com/v1/shops/123/orders.json?page=2',
        })
      )
      .mockResolvedValueOnce(
        response({
          current_page: 2,
          data: [order('provider-target', 'fulfillment-123')],
          last_page: 2,
          next_page_url: null,
        })
      );

    await expect(findOrderByExternalId('123', 'fulfillment-123')).resolves.toMatchObject({
      order: { id: 'provider-target' },
      pagesScanned: 2,
      exhaustive: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('limit=10');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('page=1');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('page=2');
  });

  it('reports a bounded scan as non-exhaustive rather than claiming absence', async () => {
    fetchMock.mockResolvedValue(
      response({
        current_page: 1,
        data: [order('provider-other', 'other-external-id')],
        last_page: 3,
        next_page_url: 'https://api.printify.com/v1/shops/123/orders.json?page=2',
      })
    );

    await expect(
      findOrderByExternalId('123', 'fulfillment-missing', { maxPages: 1 })
    ).resolves.toEqual({
      pagesScanned: 1,
      exhaustive: false,
    });
  });

  it('also recognizes Printify shop-order labels as the submitted external id', async () => {
    const target = order('provider-label', 'different-id');
    target.metadata.shop_order_id = 'different-id-2';
    target.metadata.shop_order_label = 'fulfillment-label';

    fetchMock.mockResolvedValue(
      response({
        current_page: 1,
        data: [target],
        last_page: 1,
        next_page_url: null,
      })
    );

    await expect(findOrderByExternalId('123', 'fulfillment-label')).resolves.toMatchObject({
      order: { id: 'provider-label' },
      pagesScanned: 1,
      exhaustive: true,
    });
  });
});
