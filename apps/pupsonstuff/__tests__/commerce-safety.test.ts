import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateCheckoutGate } from '../lib/commerce-safety';
import { createCheckoutSession } from '../lib/stripe';

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    STRIPE_SECRET_KEY: 'sk_test_PUPSON_TEST_ONLY',
    PUPSON_FULFILLMENT_MODE: 'dry_run',
    VERCEL_ENV: 'preview',
    PUPSON_LIVE_COMMERCE_APPROVED: 'false',
    PUPSON_PAYMENT_OPERATIONS_READY: 'false',
    PUPSON_PUBLIC_ORIGIN: 'https://www.pupsonstuff.com',
    ...overrides,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('commerce activation boundary', () => {
  it('allows test-only Stripe checkout with dry-run fulfillment', () => {
    expect(evaluateCheckoutGate(env())).toMatchObject({ permitted: true, mode: 'test' });
  });

  it('rejects live payment keys while fulfillment is dry-run', () => {
    expect(evaluateCheckoutGate(env({ STRIPE_SECRET_KEY: 'sk_live_synthetic' })).permitted).toBe(false);
  });

  it('rejects live payment keys in preview even when approval flags are set', () => {
    expect(evaluateCheckoutGate(env({
      STRIPE_SECRET_KEY: 'sk_live_synthetic',
      PUPSON_FULFILLMENT_MODE: 'live',
      PUPSON_LIVE_COMMERCE_APPROVED: 'true',
      PUPSON_PAYMENT_OPERATIONS_READY: 'true',
    })).permitted).toBe(false);
  });

  it('requires both independent release flags, exact origin, and production mode', () => {
    const live = env({
      STRIPE_SECRET_KEY: 'sk_live_synthetic',
      VERCEL_ENV: 'production',
      PUPSON_FULFILLMENT_MODE: 'live',
      PUPSON_LIVE_COMMERCE_APPROVED: 'true',
      PUPSON_PAYMENT_OPERATIONS_READY: 'true',
    });
    expect(evaluateCheckoutGate(live)).toMatchObject({ permitted: true, mode: 'live' });
    for (const [field, wrong] of [
      ['PUPSON_LIVE_COMMERCE_APPROVED', 'false'],
      ['PUPSON_PAYMENT_OPERATIONS_READY', 'false'],
      ['PUPSON_PUBLIC_ORIGIN', 'https://other.example'],
      ['PUPSON_FULFILLMENT_MODE', 'dry_run'],
      ['VERCEL_ENV', 'preview'],
    ]) {
      expect(evaluateCheckoutGate({ ...live, [field]: wrong }).permitted).toBe(false);
    }
  });

  it('never accepts unknown key types or production test checkout', () => {
    expect(evaluateCheckoutGate(env({ STRIPE_SECRET_KEY: 'not-a-stripe-key' })).permitted).toBe(false);
    expect(evaluateCheckoutGate(env({ VERCEL_ENV: 'production' })).permitted).toBe(false);
    expect(evaluateCheckoutGate(env({ PUPSON_FULFILLMENT_MODE: 'live' })).permitted).toBe(false);
  });

  it('fails before any Stripe SDK call when a real key is present without approval', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_synthetic');
    vi.stubEnv('PUPSON_FULFILLMENT_MODE', 'dry_run');
    vi.stubEnv('VERCEL_ENV', 'production');
    const answer = await createCheckoutSession({
      items: [{}] as never[],
      successUrl: 'https://www.pupsonstuff.com/checkout/success',
      cancelUrl: 'https://www.pupsonstuff.com/',
    });
    expect(answer.success).toBe(false);
    if (!answer.success) expect(answer.error).toContain('Live checkout requires');
  });
});
