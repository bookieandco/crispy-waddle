export type FinancialLedgerEntryKind =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'trade'
  | 'fee'
  | 'refund'
  | 'adjustment';

export type FinancialLedgerEntryStatus = 'pending' | 'posted' | 'failed' | 'reversed';

export type FinancialLedgerEntry = {
  id: string;
  idempotencyKey: string;
  kind: FinancialLedgerEntryKind;
  status: FinancialLedgerEntryStatus;
  currency: string;
  amountMinor: bigint;
  sourceAccountId?: string;
  destinationAccountId?: string;
  provider: string;
  providerReference?: string;
  occurredAt: string;
  metadata?: Readonly<Record<string, string>>;
};

export interface FinancialLedger {
  append(entry: FinancialLedgerEntry): Promise<void>;
  getById(id: string): Promise<FinancialLedgerEntry | null>;
  getByIdempotencyKey(key: string): Promise<FinancialLedgerEntry | null>;
}

/**
 * In-memory ledger for tests and local development.
 * Production implementations must persist entries durably and enforce
 * uniqueness on both id and idempotencyKey.
 */
export class InMemoryFinancialLedger implements FinancialLedger {
  private readonly entries = new Map<string, FinancialLedgerEntry>();
  private readonly idempotency = new Map<string, string>();

  async append(entry: FinancialLedgerEntry): Promise<void> {
    if (this.entries.has(entry.id)) throw new Error('MONEY_LEDGER_DUPLICATE_ID');
    if (this.idempotency.has(entry.idempotencyKey)) {
      throw new Error('MONEY_LEDGER_DUPLICATE_IDEMPOTENCY_KEY');
    }
    if (entry.amountMinor < 0n) throw new Error('MONEY_LEDGER_NEGATIVE_AMOUNT');
    if (!/^[A-Z]{3}$/.test(entry.currency)) throw new Error('MONEY_INVALID_CURRENCY');

    this.entries.set(entry.id, entry);
    this.idempotency.set(entry.idempotencyKey, entry.id);
  }

  async getById(id: string): Promise<FinancialLedgerEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getByIdempotencyKey(key: string): Promise<FinancialLedgerEntry | null> {
    const id = this.idempotency.get(key);
    return id ? this.entries.get(id) ?? null : null;
  }
}
