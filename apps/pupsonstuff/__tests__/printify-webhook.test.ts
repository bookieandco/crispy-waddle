import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  printifyFulfillmentStatus,
  printifyProviderOrderId,
  printifyTrackingPayload,
  resolvePrintifyWebhookSecret,
  verifyPrintifyWebhookSignature,
  type PrintifyWebhookEvent,
} from '../lib/printify-webhook';

function signature(body: string, secret: string) {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

describe('Printify webhook contract', () => {
  it('verifies the official X-Pfy-Signature HMAC over the raw body', () => {
    const body = JSON.stringify({ id: 'evt-1', type: 'order:created' });
    const secret = 'test-secret';
    expect(verifyPrintifyWebhookSignature(body, signature(body, secret), secret)).toBe(true);
    expect(verifyPrintifyWebhookSignature(body + ' ', signature(body, secret), secret)).toBe(false);
    expect(verifyPrintifyWebhookSignature(body, 'sha256=not-hex', secret)).toBe(false);
    expect(verifyPrintifyWebhookSignature(body, null, secret)).toBe(false);
  });


  it('prefers a dedicated signing secret and derives a stable fallback from the Printify token', () => {
    const dedicated = resolvePrintifyWebhookSecret({
      NODE_ENV: 'test',
      PRINTIFY_API_KEY: 'api-key',
      PUPSON_PRINTIFY_WEBHOOK_SECRET: 'd'.repeat(40),
    } as NodeJS.ProcessEnv);
    expect(dedicated).toBe('d'.repeat(40));

    const first = resolvePrintifyWebhookSecret({
      NODE_ENV: 'test',
      PRINTIFY_API_KEY: 'api-key',
      PUPSON_PRINTIFY_WEBHOOK_SECRET: '',
    } as NodeJS.ProcessEnv);
    const second = resolvePrintifyWebhookSecret({
      NODE_ENV: 'test',
      PRINTIFY_API_KEY: 'api-key',
    } as NodeJS.ProcessEnv);
    const different = resolvePrintifyWebhookSecret({
      NODE_ENV: 'test',
      PRINTIFY_API_KEY: 'other-api-key',
    } as NodeJS.ProcessEnv);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(
      resolvePrintifyWebhookSecret({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)
    ).toBeUndefined();
  });

  it('uses resource.id as the Printify order id', () => {
    expect(
      printifyProviderOrderId({
        type: 'order:updated',
        resource: { id: 'order-123', type: 'order', data: { shop_id: 1 } },
      })
    ).toBe('order-123');
  });

  it('maps Printify lifecycle events into the durable fulfillment states', () => {
    const event = (type: string, status?: string): PrintifyWebhookEvent => ({
      type,
      resource: { id: 'order-1', type: 'order', data: { shop_id: 1, status } },
    });

    expect(printifyFulfillmentStatus(event('order:sent-to-production'))).toBe('in_production');
    expect(printifyFulfillmentStatus(event('order:updated', 'in-production'))).toBe('in_production');
    expect(printifyFulfillmentStatus(event('order:shipment:created'))).toBe('shipped');
    expect(printifyFulfillmentStatus(event('order:shipment:delivered'))).toBe('fulfilled');
    expect(printifyFulfillmentStatus(event('order:updated', 'canceled'))).toBe('cancelled');
    expect(printifyFulfillmentStatus(event('order:updated', 'has-issues'))).toBe('failed');
    expect(printifyFulfillmentStatus(event('order:updated', 'pending'))).toBeUndefined();
  });

  it('extracts shipment tracking without trusting unrelated events', () => {
    expect(
      printifyTrackingPayload({
        type: 'order:shipment:created',
        resource: {
          id: 'order-1',
          data: {
            shop_id: 1,
            carrier: { code: 'USPS', tracking_number: '9400' },
          },
        },
      })
    ).toEqual({ carrier: 'USPS', number: '9400', deliveredAt: null });

    expect(
      printifyTrackingPayload({
        type: 'order:updated',
        resource: { id: 'order-1', data: { shop_id: 1, status: 'in-production' } },
      })
    ).toBeNull();
  });
});
