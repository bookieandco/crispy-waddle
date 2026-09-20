export type SafetyProviderChannel = 'push' | 'sms' | 'email' | 'call';

export interface SafetyProviderAttempt {
  readonly idempotencyKey: string;
  readonly incidentId: string;
  readonly recipientId: string;
  readonly channel: SafetyProviderChannel;
  readonly contentRef: string;
}

export interface SafetyProviderReceipt {
  readonly idempotencyKey: string;
  readonly accepted: boolean;
  readonly providerReference?: string;
  readonly deliveredAt?: string;
  readonly acknowledgedAt?: string;
  readonly retryable: boolean;
}

export interface SafetyDeliveryProvider {
  readonly channel: SafetyProviderChannel;
  deliver(attempt: SafetyProviderAttempt): Promise<SafetyProviderReceipt>;
}

export class SafetyProviderRouter {
  constructor(private readonly providers: readonly SafetyDeliveryProvider[]) {}

  async deliver(attempt: SafetyProviderAttempt): Promise<SafetyProviderReceipt> {
    const provider = this.providers.find((item) => item.channel === attempt.channel);
    if (!provider) return { idempotencyKey: attempt.idempotencyKey, accepted: false, retryable: false };
    return provider.deliver(attempt);
  }
}
