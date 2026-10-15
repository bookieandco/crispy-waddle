
import { describe, expect, it } from 'vitest';
import { previewApiBlocked } from '../lib/cloudflare-preview-policy';
import { evaluateCheckoutGate } from '../lib/commerce-safety';

describe('Cloudflare Free view-only preview boundary', () => {
  it('permits page navigation and GET health but blocks all other API methods', () => {
    expect(previewApiBlocked('/', 'GET', true)).toBe(false);
    expect(previewApiBlocked('/products', 'GET', true)).toBe(false);
    expect(previewApiBlocked('/api/health', 'GET', true)).toBe(false);
    expect(previewApiBlocked('/api/health', 'HEAD', true)).toBe(false);
    for (const [path, method] of [
      ['/api/checkout', 'POST'],
      ['/api/stripe/webhook', 'POST'],
      ['/api/creative/jobs', 'POST'],
      ['/api/creative/jobs', 'GET'],
      ['/api/internal/creative-worker', 'GET'],
      ['/api/admin/orders', 'GET'],
      ['/api/health', 'POST'],
      ['/api', 'GET'],
    ]) expect(previewApiBlocked(path, method, true)).toBe(true);
  });

  it('does not change existing API behavior outside preview', () => {
    expect(previewApiBlocked('/api/creative/jobs', 'POST', false)).toBe(false);
    expect(previewApiBlocked('/api/health', 'GET', false)).toBe(false);
  });

  it('rejects Stripe test and live keys even if accidentally provisioned to preview', () => {
    for (const key of ['sk_test_fake', 'sk_live_fake']) {
      expect(evaluateCheckoutGate({
        NODE_ENV: 'test',
        STRIPE_SECRET_KEY: key,
        VERCEL_ENV: 'production',
        PUPSON_PUBLIC_ORIGIN: 'https://www.pupsonstuff.com',
        PUPSON_CLOUDFLARE_PREVIEW_ONLY: 'true',
        PUPSON_FULFILLMENT_MODE: 'live',
        PUPSON_LIVE_COMMERCE_APPROVED: 'true',
        PUPSON_PAYMENT_OPERATIONS_READY: 'true',
      })).toMatchObject({ permitted: false, mode: 'blocked' });
    }
  });
});
