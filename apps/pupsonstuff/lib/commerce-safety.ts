/**
 * Fail-closed checkout activation.
 *
 * Dry-run fulfillment must never be mistaken for Stripe test mode: Stripe can
 * accept real money even while the provider order queue is in dry_run.
 * Production charges require a separate, deliberate two-key operational gate.
 */
export interface CommerceCheckoutGate {
  permitted: boolean;
  mode: 'test' | 'live' | 'blocked';
  reason: string;
}
const CANONICAL_ORIGIN = 'https://www.pupsonstuff.com';

export function evaluateCheckoutGate(
  env: NodeJS.ProcessEnv = process.env
): CommerceCheckoutGate {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? '';
  const fulfill = env.PUPSON_FULFILLMENT_MODE?.trim();
  const runtime = env.VERCEL_ENV?.trim() || 'unknown';
  if (key.startsWith('sk_test_')) {
    if (fulfill !== 'dry_run') {
      return {
        permitted: false, mode: 'blocked',
        reason: 'Test checkout requires dry-run Printify fulfillment.',
      };
    }
    if (runtime === 'production') {
      return {
        permitted: false, mode: 'blocked',
        reason: 'Production cannot accept test-mode checkout sessions.',
      };
    }
    return {
      permitted: true, mode: 'test',
      reason: 'Stripe test mode and dry-run fulfillment are enabled.',
    };
  }
  if (key.startsWith('sk_live_')) {
    if (runtime !== 'production' ||
        env.PUPSON_PUBLIC_ORIGIN?.replace(/\/$/, '') !== CANONICAL_ORIGIN ||
        fulfill !== 'live' ||
        env.PUPSON_LIVE_COMMERCE_APPROVED !== 'true' ||
        env.PUPSON_PAYMENT_OPERATIONS_READY !== 'true') {
      return {
        permitted: false, mode: 'blocked',
        reason: 'Live checkout requires production origin, sample-certified live fulfillment, and explicit commerce operations approval.',
      };
    }
    return {
      permitted: true, mode: 'live',
      reason: 'Live commerce is explicitly activated and requires per-item sample certification.',
    };
  }
  return {
    permitted: false, mode: 'blocked',
    reason: 'Checkout is not configured with a recognized Stripe test or live key.',
  };
}
