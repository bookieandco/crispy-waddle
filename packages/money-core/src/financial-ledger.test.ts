import { describe, expect, it } from 'vitest';
import { InMemoryFinancialLedger, type FinancialLedgerEntry } from './financial-ledger.js';

const entry: FinancialLedgerEntry = {
  id: 'ledger_1',
  idempotencyKey: 'intent_1',
  kind: 'transfer',
  status: 'posted',
  currency: 'USD',
  amountMinor: 5000n,
  sourceAccountId: 'bank_1',
  destinationAccountId: 'broker_1',
  provider: 'test-bank',
  providerReference: 'provider_1',
  occurredAt: '2026-08-29T00:00:00.000Z',
};

describe('financial ledger', () => {
  it('appends and retrieves by id and idempotency key', async () => {
    const ledger = new InMemoryFinancialLedger();
    await ledger.append(entry);
    await expect(ledger.getById(entry.id)).resolves.toEqual(entry);
    await expect(ledger.getByIdempotencyKey(entry.idempotencyKey)).resolves.toEqual(entry);
  });

  it('rejects duplicate ids', async () => {
    const ledger = new InMemoryFinancialLedger();
    await ledger.append(entry);
    await expect(ledger.append(entry)).rejects.toThrow('MONEY_LEDGER_DUPLICATE_ID');
  });

  it('rejects duplicate idempotency keys', async () => {
    const ledger = new InMemoryFinancialLedger();
    await ledger.append(entry);
    await expect(ledger.append({ ...entry, id: 'ledger_2' })).rejects.toThrow('MONEY_LEDGER_DUPLICATE_IDEMPOTENCY_KEY');
  });
});
