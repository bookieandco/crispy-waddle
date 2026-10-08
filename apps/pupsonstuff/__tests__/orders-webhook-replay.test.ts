import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertPaidOrder } from '../lib/orders';
import type { ValidatedCartItem } from '../lib/catalog';

const orderId = '95dd4a20-f242-4dda-8cbb-54e0357a593c';
const sessionId = 'cs_test_signed_paid_session';
const printId = '0a1f3a35-c95e-4767-b4f8-1c3abea7a8a2';
const outputId = 'ed8ec76f-7f83-46c9-88f8-05d06f398a96';

const item = {
  id: 'li_pupson_1',
  productId: 'frame1',
  variantId: 'canvas-12x16',
  productName: 'Canvas',
  variantLabel: '12x16',
  artStyle: 'oil-painting',
  priceCents: 5000,
  quantity: 1,
  creativeOutputId: outputId,
  printAssetId: printId,
  fulfillmentProvider: 'printify',
  providerProductId: 'provider-product',
  providerVariantId: '82230',
  blueprintId: '937',
  printProviderId: '99',
  printArea: 'front',
  catalogCertificationStatus: 'sandbox_verified',
} as ValidatedCartItem;

const payload = {
  stripeSessionId: sessionId,
  stripePaymentIntentId: 'pi_test_1',
  currency: 'usd',
  amountTotalCents: 5000,
  paidAt: '2026-10-08T01:00:00.000Z',
};

interface FakeState {
  row: Record<string, unknown> | null;
  writes: Array<{ path: string; method: string; prefer: string; body: Record<string, unknown> | null }>;
  items: Set<string>;
  failFirstItem?: boolean;
}
function fakeDatabase(state: FakeState) {
  return vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.split('/rest/v1/')[1] || '';
    const method = String(init.method || 'GET');
    const headers = init.headers as Record<string, string> | undefined;
    const prefer = headers?.Prefer ?? '';
    const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    if (method !== 'GET') state.writes.push({ path, method, prefer, body });
    if (path.startsWith('pupson_orders?on_conflict=stripe_session_id') && method === 'POST') {
      if (!prefer.includes('resolution=ignore-duplicates')) {
        return Response.json({ error: 'Replay must be insert-ignore' }, { status: 422 });
      }
      if (state.row) return Response.json([]);
      state.row = { id: orderId, stripe_session_id: sessionId, status: 'paid', fulfillment_status: 'pending' };
      return Response.json([state.row]);
    }
    if (path.startsWith('pupson_orders?select=') && method === 'GET') {
      return Response.json(state.row ? [state.row] : []);
    }
    if (path.startsWith('pupson_creative_outputs?select=') && method === 'GET') {
      return Response.json([{ id: outputId }]);
    }
    if (path.startsWith('pupson_media_assets?select=') && method === 'GET') {
      return Response.json([{ id: printId, kind: 'print_ready',
        provenance: { creativeOutputId: outputId,
          printProfile: { productId: 'frame1', variantId: 'canvas-12x16' } } }]);
    }
    if (path.startsWith('pupson_order_items?on_conflict=stripe_line_item_id') && method === 'POST') {
      if (state.failFirstItem) {
        state.failFirstItem = false;
        return Response.json({ error: 'synthetic transient failure' }, { status: 503 });
      }
      if (!prefer.includes('resolution=ignore-duplicates')) {
        return Response.json({ error: 'Line item must be insert-ignore' }, { status: 422 });
      }
      state.items.add(String(body?.stripe_line_item_id));
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected Pupson database request: ${method} ${path}`);
  });
}
function newState(row: Record<string, unknown> | null = null): FakeState {
  return { row, writes: [], items: new Set() };
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://pupson-test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-test-key');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Stripe webhook paid order persistence', () => {
  it('creates one paid order and exactly one verified line item', async () => {
    const state = newState();
    vi.stubGlobal('fetch', fakeDatabase(state));
    const row = await upsertPaidOrder(payload, [item]);
    expect(row).toMatchObject({ id: orderId, stripe_session_id: sessionId });
    expect(state.row?.fulfillment_status).toBe('pending');
    expect(state.items.has('li_pupson_1')).toBe(true);
    expect(state.writes.filter(x => x.path.startsWith('pupson_orders?'))).toHaveLength(1);
    expect(state.writes.filter(x => x.path.startsWith('pupson_order_items?'))).toHaveLength(1);
  });

  it('preserves shipped/cancelled/fulfilled states under repeated paid session events', async () => {
    for (const status of ['submitted', 'in_production', 'shipped', 'fulfilled', 'cancelled']) {
      const state = newState({ id: orderId, stripe_session_id: sessionId,
        status: 'paid', fulfillment_status: status });
      vi.stubGlobal('fetch', fakeDatabase(state));
      const row = await upsertPaidOrder(payload, [item]);
      expect(row.id).toBe(orderId);
      expect(state.row?.fulfillment_status).toBe(status);
      expect(state.writes.filter(x => x.path.startsWith('pupson_orders?'))[0]?.prefer)
        .toContain('resolution=ignore-duplicates');
      expect(state.items.size).toBe(1);
    }
  });

  it('recovers after transient line-item insertion failure on signed webhook retry', async () => {
    const state = newState();
    state.failFirstItem = true;
    vi.stubGlobal('fetch', fakeDatabase(state));
    await expect(upsertPaidOrder(payload, [item])).rejects.toThrow(/order-item insert failed/);
    expect(state.row?.id).toBe(orderId);
    state.row!.fulfillment_status = 'submitted';
    const second = await upsertPaidOrder(payload, [item]);
    expect(second.id).toBe(orderId);
    expect(state.row?.fulfillment_status).toBe('submitted');
    expect(state.items.size).toBe(1);
    expect(state.writes.filter(x => x.path.startsWith('pupson_orders?'))).toHaveLength(2);
    expect(state.writes.filter(x => x.path.startsWith('pupson_order_items?'))).toHaveLength(2);
  });

  it('deduplicates concurrent webhook deliveries using unique session and line-item keys', async () => {
    const state = newState();
    vi.stubGlobal('fetch', fakeDatabase(state));
    const rows = await Promise.all([
      upsertPaidOrder(payload, [item]),
      upsertPaidOrder(payload, [item]),
    ]);
    expect(rows.map(x => x.id)).toEqual([orderId, orderId]);
    expect(state.items.size).toBe(1);
    expect(state.writes.filter(x => x.path.startsWith('pupson_orders?'))).toHaveLength(2);
    expect(state.writes.filter(x => x.path.startsWith('pupson_order_items?'))).toHaveLength(2);
  });

  it('fails closed if a conflicting lookup returns the wrong Stripe session', async () => {
    const state = newState({ id: orderId, stripe_session_id: 'cs_test_other', fulfillment_status: 'shipped' });
    vi.stubGlobal('fetch', fakeDatabase(state));
    await expect(upsertPaidOrder(payload, [item])).rejects.toThrow(/not reconciled/);
    expect(state.writes.filter(x => x.path.startsWith('pupson_order_items?'))).toHaveLength(0);
  });
});
