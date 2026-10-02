import { createHmac, timingSafeEqual } from 'node:crypto';

const WEBHOOK_SECRET_DERIVATION_LABEL = 'pupsonstuff:printify-webhook:v1';

export function resolvePrintifyWebhookSecret(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const apiKey = env.PRINTIFY_API_KEY?.trim();
  if (apiKey) {
    // Domain-separated deterministic signing key. Canonicalizing on the
    // Printify token prevents webhook registration and runtime verification
    // from drifting if a secondary secret appears in only one environment.
    return createHmac('sha256', apiKey)
      .update(WEBHOOK_SECRET_DERIVATION_LABEL, 'utf8')
      .digest('hex');
  }

  // Fallback-only for environments that intentionally verify a previously
  // provisioned webhook without holding the Printify API token.
  return env.PUPSON_PRINTIFY_WEBHOOK_SECRET?.trim() || undefined;
}

export interface PrintifyWebhookEvent {
  id?: string;
  type?: string;
  created_at?: string;
  resource?: {
    id?: string | number;
    type?: string;
    data?: {
      shop_id?: string | number;
      status?: string;
      shipped_at?: string;
      delivered_at?: string;
      carrier?: {
        code?: string;
        tracking_number?: string;
      };
      skus?: string[];
      [key: string]: unknown;
    } | null;
  };
}

export function verifyPrintifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !signature?.startsWith('sha256=')) return false;

  const suppliedHex = signature.slice('sha256='.length).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(suppliedHex)) return false;

  const expectedHex = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function printifyProviderOrderId(event: PrintifyWebhookEvent): string | null {
  const value = event.resource?.id;
  return value === undefined || value === null || value === '' ? null : String(value);
}

export function printifyFulfillmentStatus(
  event: PrintifyWebhookEvent
): 'in_production' | 'shipped' | 'fulfilled' | 'cancelled' | 'failed' | undefined {
  const type = event.type ?? '';

  if (type === 'order:shipment:delivered') return 'fulfilled';
  if (type === 'order:shipment:created') return 'shipped';
  if (type === 'order:sent-to-production') return 'in_production';

  if (type !== 'order:updated') return undefined;

  switch (event.resource?.data?.status) {
    case 'sending-to-production':
    case 'in-production':
    case 'sending_to_production_delegate':
    case 'sending_to_production_delegate_sync':
      return 'in_production';
    case 'fulfilled':
      return 'fulfilled';
    case 'canceled':
      return 'cancelled';
    case 'payment-not-received':
    case 'has-issues':
    case 'unfulfillable':
    case 'source-check-failed':
      return 'failed';
    default:
      return undefined;
  }
}

export function printifyTrackingPayload(event: PrintifyWebhookEvent) {
  if (event.type !== 'order:shipment:created' && event.type !== 'order:shipment:delivered') {
    return null;
  }

  const carrier = event.resource?.data?.carrier;
  const trackingNumber = carrier?.tracking_number?.trim();
  if (!trackingNumber) return null;

  return {
    carrier: carrier?.code?.trim() || null,
    number: trackingNumber,
    deliveredAt:
      event.type === 'order:shipment:delivered'
        ? event.resource?.data?.delivered_at ?? null
        : null,
  };
}
