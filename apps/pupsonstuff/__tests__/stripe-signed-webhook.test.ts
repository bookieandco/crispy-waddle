import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  validateStripeLineItems: vi.fn(),
  upsertPaidOrder: vi.fn(),
  queueFulfillment: vi.fn(),
  listLineItems: vi.fn(),
}));
vi.mock('@/lib/stripe', () => ({ getStripeClient: mocks.getStripeClient }));
vi.mock('@/lib/catalog', () => ({ validateStripeLineItems: mocks.validateStripeLineItems }));
vi.mock('@/lib/orders', () => ({ upsertPaidOrder: mocks.upsertPaidOrder }));
vi.mock('@/lib/fulfillment-bridge', () => ({ queueFulfillment: mocks.queueFulfillment }));

import { POST } from '../app/api/stripe/webhook/route';

const secret = 'whsec_test_pupson_signed_webhook';
const verifier = new Stripe('sk_test_synthetic_no_external_requests');

const line = {
  id: 'li_1',
  quantity: 1,
  price: {
    unit_amount: 5000,
    product: { id: 'prod_1', name: 'Canvas', deleted: false, metadata: {
      product_id: 'frame1', variant_id: 'canvas-12x16',
      art_style: 'oil-painting', creative_output_id: 'output-1',
      print_asset_id: 'print-1', fulfillment_provider: 'printify',
      provider_variant_id: '82230', blueprint_id: '937',
      print_provider_id: '99', print_area: 'front',
      catalog_certification_status: 'sandbox_verified',
    } },
  },
};
function eventBody(type = 'checkout.session.completed', paymentStatus = 'paid') {
  return JSON.stringify({
    id: 'evt_test_1', object: 'event', api_version: '2026-09-30.clover',
    type, created: 1791450300, livemode: false,
    data: { object: {
      id: 'cs_test_pupson_1', object: 'checkout.session',
      payment_status: paymentStatus, customer_details: { email: 'synthetic@example.invalid' },
      currency: 'usd', amount_total: 5000, created: 1791450300,
      payment_intent: 'pi_test_pupson_1',
      collected_information: { shipping_details: {
        name: 'Test Buyer',
        address: { city: 'Portland', country: 'US', line1: '1 Test Ave', postal_code: '97035', state: 'OR' },
      } },
    } },
  });
}
function signedRequest(body: string, tamper = false): NextRequest {
  const sig = verifier.webhooks.generateTestHeaderString({ payload: body, secret });
  return new NextRequest('https://preview.vercel.app/api/stripe/webhook', {
    method: 'POST', headers: { 'stripe-signature': tamper ? 't=1,v1=invalid' : sig,
      'content-type': 'application/json' }, body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  mocks.getStripeClient.mockReturnValue({
    webhooks: verifier.webhooks,
    checkout: { sessions: { listLineItems: mocks.listLineItems } },
  });
  mocks.listLineItems.mockResolvedValue({ data: [line] });
  mocks.validateStripeLineItems.mockReturnValue([{ id: 'li_1' }]);
  mocks.upsertPaidOrder.mockResolvedValue({ id: 'db-order-1' });
  mocks.queueFulfillment.mockResolvedValue('queued-1');
});
afterEach(() => vi.unstubAllEnvs());

describe('Pupson Stripe signed webhook', () => {
  it('rejects invalid signatures before querying paid items or creating an order', async () => {
    const response = await POST(signedRequest(eventBody(), true));
    expect(response.status).toBe(400);
    expect(mocks.listLineItems).not.toHaveBeenCalled();
    expect(mocks.upsertPaidOrder).not.toHaveBeenCalled();
    expect(mocks.queueFulfillment).not.toHaveBeenCalled();
  });

  it('persists a verified test-mode paid checkout and idempotently replays the same signed event', async () => {
    const body = eventBody();
    const first = await POST(signedRequest(body));
    const second = await POST(signedRequest(body));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      received: true, orderId: 'db-order-1', fulfillmentId: 'queued-1',
    });
    expect(mocks.upsertPaidOrder).toHaveBeenCalledTimes(2);
    expect(mocks.queueFulfillment).toHaveBeenNthCalledWith(2, 'db-order-1');
    expect(mocks.upsertPaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSessionId: 'cs_test_pupson_1', amountTotalCents: 5000 }),
      [{ id: 'li_1' }]
    );
  });

  it('acknowledges unpaid sessions without queuing fulfillment', async () => {
    const response = await POST(signedRequest(eventBody('checkout.session.completed', 'unpaid')));
    expect(response.status).toBe(200);
    expect(mocks.upsertPaidOrder).not.toHaveBeenCalled();
    expect(mocks.queueFulfillment).not.toHaveBeenCalled();
  });

  it('ignores unrelated authenticated Stripe event types', async () => {
    const response = await POST(signedRequest(eventBody('customer.created')));
    expect(response.status).toBe(200);
    expect(mocks.listLineItems).not.toHaveBeenCalled();
    expect(mocks.upsertPaidOrder).not.toHaveBeenCalled();
  });

  it('returns an error for a transient order write so Stripe can retry', async () => {
    mocks.upsertPaidOrder.mockRejectedValueOnce(new Error('synthetic database outage'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await POST(signedRequest(eventBody()));
      expect(response.status).toBe(500);
      expect((await response.json()).error).toMatch(/retry/i);
      expect(mocks.queueFulfillment).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('does not accept payment events without a verifier or signing secret', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const response = await POST(signedRequest(eventBody()));
    expect(response.status).toBe(503);
    expect(mocks.upsertPaidOrder).not.toHaveBeenCalled();
  });
});
