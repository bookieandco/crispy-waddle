import type { ExecutionAttempt } from './execution-attempt.js';
import type { MoneyExecutionReconciliationAdapter } from './execution-reconciliation-adapter.js';
import { createProviderExecutionIdentityFromAttempt } from './provider-execution-identity.js';
import { recoveryEvidenceHash } from './postgres-execution-recovery-ledger.js';
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

/** Read-only Stripe PaymentIntent reconciliation. It never retries or mutates provider state. */
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
    return attempt.provider === this.provider && attempt.operation === 'payment.create'
      && !!attempt.providerReference && /^pi_[A-Za-z0-9]+$/.test(attempt.providerReference);
  }

  async reconcile(attempt: ExecutionAttempt): Promise<RecoveryObservation> {
    if (!this.canReconcile(attempt)) throw new Error('MONEY_STRIPE_RECONCILIATION_UNSUPPORTED_EXECUTION');
    const identity = createProviderExecutionIdentityFromAttempt(attempt);
    const checkedAt = new Date().toISOString();
    const paymentIntent = await this.getPaymentIntent(attempt.providerReference!);
    const metadata = isRecord(paymentIntent.metadata) ? paymentIntent.metadata : {};
    const identityMatches = metadata.jhadina_execution_id === identity.executionId
      && metadata.jhadina_action_fingerprint === identity.actionFingerprint
      && metadata.jhadina_idempotency_key === identity.idempotencyKey;
    const observedState = identityMatches ? classifyStripePaymentIntent(paymentIntent.status) : 'CONFLICT';
    const observationWithoutHash: Omit<RecoveryObservation, 'evidenceHash'> = {
      executionId: identity.executionId,
      proposalHash: identity.actionFingerprint,
      providerOperation: identity.operation,
      providerReference: typeof paymentIntent.id === 'string' ? paymentIntent.id : undefined,
      observedState,
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
      adapterId: this.adapterId,
      adapterVersion: this.adapterVersion,
      checkedAt,
    };
    return { ...observationWithoutHash, evidenceHash: recoveryEvidenceHash(observationWithoutHash) };
  }

  private async getPaymentIntent(id: string): Promise<StripePaymentIntent> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(new URL(`/v1/payment_intents/${encodeURIComponent(id)}`, this.baseUrl), {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.secret}` },
        signal: controller.signal,
      });
      if (response.status === 404) return { id, status: '__not_found__', metadata: {} };
      if (!response.ok) throw new Error(`MONEY_STRIPE_RECONCILIATION_HTTP_ERROR:${response.status}`);
      return await response.json() as StripePaymentIntent;
    } finally { clearTimeout(timeout); }
  }
}

function isRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function classifyStripePaymentIntent(status: unknown): RecoveryObservation['observedState'] {
  switch (status) {
    case 'succeeded': return 'SUCCEEDED';
    case 'canceled': return 'FAILED';
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
    case 'requires_capture': return 'PENDING';
    case '__not_found__': return 'NOT_FOUND';
    default: return 'UNKNOWN';
  }
}
