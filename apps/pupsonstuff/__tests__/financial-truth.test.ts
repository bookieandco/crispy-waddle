import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recordStripePaymentEconomics,
  recordStripeRefundEconomicsByPaymentIntent,
} from '../lib/orders';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('PupsonStuff realized Stripe financial truth', () => {
  it('persists payment fee/net evidence and an idempotent financial event', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: 'order-1',
        status: 'paid',
        amount_total_cents: 3000,
        refunded_amount_cents: 0,
      }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await recordStripePaymentEconomics('order-1', {
      providerEventId: 'evt_checkout',
      chargeId: 'ch_1',
      balanceTransactionId: 'txn_1',
      feeCents: 117,
      netCents: 2883,
      observedAt: '2026-10-04T12:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const paymentRequest = fetchMock.mock.calls[0]!;
    expect(String(paymentRequest[0])).toContain('pupson_orders?id=eq.order-1');
    const paymentBody = JSON.parse(String(paymentRequest[1]?.body));
    expect(paymentBody.stripe_charge_id).toBe('ch_1');
    expect(paymentBody.stripe_fee_cents).toBe(117);
    expect(paymentBody.stripe_net_cents).toBe(2883);

    const eventRequest = fetchMock.mock.calls[1]!;
    expect(String(eventRequest[0])).toContain(
      'pupson_order_financial_events?on_conflict=provider,provider_event_id'
    );
    expect(String(eventRequest[1]?.headers?.Prefer)).toContain('ignore-duplicates');
  });

  it('records refund actuals and marks only a full refund as refunded', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: 'order-1',
        status: 'paid',
        amount_total_cents: 3000,
        refunded_amount_cents: 0,
      }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('', { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await recordStripeRefundEconomicsByPaymentIntent({
      providerEventId: 'evt_refund',
      paymentIntentId: 'pi_1',
      chargeId: 'ch_1',
      amountRefundedCents: 3000,
      currency: 'usd',
      observedAt: '2026-10-04T13:00:00.000Z',
    });

    expect(result).toEqual({ orderId: 'order-1', matched: true, fullyRefunded: true });
    const refundPatch = fetchMock.mock.calls[1]!;
    const patchBody = JSON.parse(String(refundPatch[1]?.body));
    expect(patchBody.refunded_amount_cents).toBe(3000);
    expect(patchBody.status).toBe('refunded');
  });
});
