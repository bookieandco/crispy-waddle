import type { ExecutionAttempt } from './execution-attempt.js';
import type { MoneyExecutionReconciliationAdapter } from './execution-reconciliation-adapter.js';
import { createProviderExecutionIdentityFromAttempt } from './provider-execution-identity.js';
import type { RecoveryObservation } from './execution-recovery.js';
import type { HttpClient } from './read-only-http-bank-adapter.js';

export type StripePaymentIntentReconciliationAdapterOptions = {
  secret: string;
  baseUrl?: string;
  fetchImpl?: HttpClient;
  timeoutMs?: number;
};

type StripePaymentIntent = {
  id?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  metadata?: unknown;
};

/**
 * Read-only reconciliation adapter for Stripe PaymentIntents.
 *
 * It never creates, confirms, captures, cancels, or retries a PaymentIntent.
 * A provider reference is required because Stripe's direct GET is the strongest
 * read-after-write recovery primitive. Search is intentionally not used here.
 */
export class StripePaymentIntentReconciliationAdapter implements MoneyExecutionReconciliationAdapter {
  readonly provider = 'stripe';
  readonly adapterId = 'stripe-payment-intent-reconciliation';
  readonly adapterVersion = 1;

  private readonly baseUrl: string;
  private readonly fetchImpl: HttpClient;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(options: StripePaymentIntentReconciliationAdapterOptions) {
    this.secret = options.secret;
    this.baseUrl = options.baseUrl ?? 'https://api.stripe.com';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (!this.secret) throw new Error('MONEY_STRIPE_RECONCILIATION_SECRET_REQUIRED');
    if (!/^https:\/\//i.test(this.baseUrl)) throw new Error('MONEY_STRIPE_BASE_URL_MUST_USE_HTTPS');
  }

  canReconcile(attempt: ExecutionAttempt): boolean {
    return attempt.provider === this.provider
      && attempt.operation === 'payment.create'
      && !!attempt.providerReference
      && /^pi_[A-Za-z0-9]+$/.test(attempt.providerReference);
  }

  async reconcile(attempt: ExecutionAttempt): Promise<RecoveryObservation> {
    if (!this.canReconcile(attempt)) throw new Error('MONEY_STRIPE_RECONCILIATION_UNSUPPORTED_EXECUTION');
    const identity = createProviderExecutionIdentityFromAttempt(attempt);
    const paymentIntent = await this.getPaymentIntent(attempt.providerReference!);
    const metadata = isRecord(paymentIntent.metadata) ? paymentIntent.metadata : {};
    const observedState = classifyStripePaymentIntent(paymentIntent.status);

    const identityMatches = metadata.jhadina_execution_id === identity.executionId
      && metadata.jhadina_action_fingerprint === identity.actionFingerprint
      && metadata.jhadina_idempotency_key === identity.idempotencyKey;

    return {
      executionId: identity.executionId,
      proposalHash: identity.actionFingerprint,
      providerOperation: identity.operation,
      providerReference: paymentIntent.id as string | undefined,
      observedState: identityMatches ? observedState : 'CONFLICT',
      evidence: {
        provider: this.provider,
        resourceType: 'payment_intent',
        resourceId: paymentIntent.id ?? null,
        status: paymentIntent.status ?? null,
        amount: paymentIntent.amount ?? null,
        currency: paymentIntent.currency ?? null,
        identityMatch: identityMatches,
        metadataKeysPresent: Object.keys(metadata).filter((key) => key.startsWith('jhadina_')).sort(),
      },
      evidenceHash: '',
      adapterId: this.adapterId,
      adapterVersion: this.adapterVersion,
      checkedAt: new Date().toISOString(),
    };
  }

  private async getPaymentIntent(id: string): Promise<StripePaymentIntent> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = new URL(`/v1/payment_intents/${encodeURIComponent(id)}`, this.baseUrl).toString();
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.secret}`,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error('MONEY_STRIPE_PAYMENT_INTENT_NOT_FOUND');
        throw new Error(`MONEY_STRIPE_RECONCILIATION_HTTP_ERROR:${response.status}`);
      }
      return await response.json() as StripePaymentIntent;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function classifyStripePaymentIntent(status: unknown): RecoveryObservation['observedState'] {
  switch (status) {
    case 'succeeded':
      return 'SUCCEEDED';
    case 'canceled':
      return 'FAILED';
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
    case 'requires_capture':
      return 'PENDING';
    default:
      return 'UNKNOWN';
  }
}
