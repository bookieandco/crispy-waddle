import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rest: vi.fn(),
}));
vi.mock('@/lib/platform', () => ({
  rest: mocks.rest,
}));
import { buildPupsonBusinessFactoryProjection } from '../lib/business-factory-projection';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PUPSON_FULFILLMENT_MODE', 'live');
});

afterEach(() => vi.unstubAllEnvs());

describe('PupsonStuff Business Factory source projection', () => {
  it('exposes certified catalog truth and only settles a final single-SKU order', async () => {
    mocks.rest.mockImplementation(async (path: string) => {
      if (path.startsWith('pupson_catalog_variants?')) return [{
        product_id: 'mug',
        variant_id: 'mug-11oz',
        provider: 'printify',
        provider_product_id: null,
        provider_variant_id: '100',
        blueprint_id: '10',
        print_provider_id: '20',
        print_area: 'front',
        retail_price_cents: 2200,
        base_cost_cents: 800,
        currency: 'usd',
        active: true,
        certification_status: 'sample_verified',
        certified_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-10-04T10:00:00.000Z',
      }];
      if (path.startsWith('pupson_order_items?select=id,order_id') && path.includes('product_id=eq.mug')) {
        return [{
          id: 'line-1',
          order_id: 'order-1',
          product_id: 'mug',
          variant_id: 'mug-11oz',
          quantity: 1,
          unit_amount_cents: 2200,
        }];
      }
      if (path.startsWith('pupson_orders?')) return [{
        id: 'order-1',
        stripe_session_id: 'cs_1',
        stripe_payment_intent_id: 'pi_1',
        status: 'paid',
        fulfillment_status: 'fulfilled',
        currency: 'usd',
        amount_total_cents: 3000,
        stripe_charge_id: 'ch_1',
        stripe_balance_transaction_id: 'txn_1',
        stripe_fee_cents: 117,
        stripe_net_cents: 2883,
        refunded_amount_cents: 0,
        financial_observed_at: '2026-08-20T12:00:00.000Z',
        paid_at: '2026-08-20T12:00:00.000Z',
      }];
      if (path.startsWith('pupson_order_items?') && path.includes('order_id=in.')) return [{
        id: 'line-1',
        order_id: 'order-1',
        product_id: 'mug',
        variant_id: 'mug-11oz',
        quantity: 1,
        unit_amount_cents: 2200,
      }];
      if (path.startsWith('pupson_fulfillment_orders?')) return [{
        id: 'fulfillment-1',
        order_id: 'order-1',
        provider: 'printify',
        provider_order_id: 'po_1',
        status: 'fulfilled',
        provider_product_cost_cents: 800,
        provider_shipping_cost_cents: 500,
        provider_tax_cents: 100,
        provider_total_cost_cents: 1400,
        provider_cost_observed_at: '2026-08-22T12:00:00.000Z',
        fulfilled_at: '2026-08-22T12:00:00.000Z',
      }];
      throw new Error(`Unexpected REST call: ${path}`);
    });

    const projection = await buildPupsonBusinessFactoryProjection({
      productId: 'mug',
      variantId: 'mug-11oz',
      now: '2026-10-04T12:00:00.000Z',
      settlementHoldDays: 30,
    });

    expect(projection.product.liveSellable).toBe(true);
    expect(projection.product.retailPriceCents).toBe(2200);
    expect(projection.settlements).toHaveLength(1);
    expect(projection.settlements[0]?.state).toBe('settled');
    expect(projection.settlements[0]?.costBasisComplete).toBe(true);
    expect(projection.settlements[0]?.transactionRefs).toContain('stripe-balance-transaction:txn_1');
    expect(projection.externalActionAuthorized).toBe(false);
  });

  it('keeps a multi-SKU order pending instead of allocating costs by guess', async () => {
    mocks.rest.mockImplementation(async (path: string) => {
      if (path.startsWith('pupson_catalog_variants?')) return [{
        product_id: 'mug',
        variant_id: 'mug-11oz',
        provider: 'printify',
        provider_product_id: null,
        provider_variant_id: '100',
        blueprint_id: '10',
        print_provider_id: '20',
        print_area: 'front',
        retail_price_cents: 2200,
        base_cost_cents: 800,
        currency: 'usd',
        active: true,
        certification_status: 'sample_verified',
        certified_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-10-04T10:00:00.000Z',
      }];
      if (path.startsWith('pupson_order_items?select=id,order_id') && path.includes('product_id=eq.mug')) {
        return [{
          id: 'line-1',
          order_id: 'order-1',
          product_id: 'mug',
          variant_id: 'mug-11oz',
          quantity: 1,
          unit_amount_cents: 2200,
        }];
      }
      if (path.startsWith('pupson_orders?')) return [{
        id: 'order-1',
        stripe_session_id: 'cs_1',
        stripe_payment_intent_id: 'pi_1',
        status: 'paid',
        fulfillment_status: 'fulfilled',
        currency: 'usd',
        amount_total_cents: 5000,
        stripe_charge_id: 'ch_1',
        stripe_balance_transaction_id: 'txn_1',
        stripe_fee_cents: 175,
        stripe_net_cents: 4825,
        refunded_amount_cents: 0,
        financial_observed_at: '2026-08-20T12:00:00.000Z',
        paid_at: '2026-08-20T12:00:00.000Z',
      }];
      if (path.startsWith('pupson_order_items?') && path.includes('order_id=in.')) return [
        {
          id: 'line-1',
          order_id: 'order-1',
          product_id: 'mug',
          variant_id: 'mug-11oz',
          quantity: 1,
          unit_amount_cents: 2200,
        },
        {
          id: 'line-2',
          order_id: 'order-1',
          product_id: 'tote',
          variant_id: 'tote-standard',
          quantity: 1,
          unit_amount_cents: 2800,
        },
      ];
      if (path.startsWith('pupson_fulfillment_orders?')) return [{
        id: 'fulfillment-1',
        order_id: 'order-1',
        provider: 'printify',
        provider_order_id: 'po_1',
        status: 'fulfilled',
        provider_product_cost_cents: 1500,
        provider_shipping_cost_cents: 600,
        provider_tax_cents: 100,
        provider_total_cost_cents: 2200,
        provider_cost_observed_at: '2026-08-22T12:00:00.000Z',
        fulfilled_at: '2026-08-22T12:00:00.000Z',
      }];
      throw new Error(`Unexpected REST call: ${path}`);
    });

    const projection = await buildPupsonBusinessFactoryProjection({
      productId: 'mug',
      variantId: 'mug-11oz',
      now: '2026-10-04T12:00:00.000Z',
      settlementHoldDays: 30,
    });

    expect(projection.settlements[0]?.state).toBe('pending');
    expect(projection.settlements[0]?.blockerCodes).toContain('MULTI_SKU_OR_BINDING_MISMATCH');
  });
});
