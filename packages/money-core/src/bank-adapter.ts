import type { MoneyCapability } from './capabilities.js';

export type MoneyAccount = { id: string; provider: string; externalId: string; type: string; currency: string; maskedName?: string };
export type MoneyTransaction = { id: string; accountId: string; amount: number; currency: string; occurredAt: string; description?: string };

export type MoneyAdapterContext = {
  userId: string;
  capability: MoneyCapability;
  requestId: string;
  /** Stable logical execution key. Providers should use this for idempotency. */
  idempotencyKey?: string;
  /** Durable Jhadina execution identity. Write-capable adapters may bind this to provider metadata. */
  executionId?: string;
  /** Canonical action fingerprint for provider-side execution identity binding. */
  actionFingerprint?: string;
};

export interface BankAdapter {
  readonly provider: string;
  listAccounts(context: MoneyAdapterContext): Promise<MoneyAccount[]>;
  listTransactions(context: MoneyAdapterContext, accountId: string): Promise<MoneyTransaction[]>;
  getStatement?(context: MoneyAdapterContext, accountId: string): Promise<Uint8Array>;
  createPayment?(context: MoneyAdapterContext, input: { accountId: string; amount: number; currency: string; payeeId: string }): Promise<{ providerReference: string; status: string }>;
  createTransfer?(context: MoneyAdapterContext, input: { fromAccountId: string; toAccountId: string; amount: number; currency: string }): Promise<{ providerReference: string; status: string }>;
}

export function assertCapability(context: MoneyAdapterContext, expected: MoneyCapability) {
  if (context.capability !== expected) throw new Error(`MONEY_CAPABILITY_MISMATCH:${expected}`);
}
