import type { CapitalDomain, PositionTransaction } from './domain';
import type { MoneyTransaction } from '@jhadina/money-core';

export type TransactionClassification = {
  domain: CapitalDomain;
  instrument: string;
  side: 'buy' | 'sell';
  quantity: number;
  unitPrice: { amount: number; currency: string };
};

export type ClassifiedMoneyTransaction = PositionTransaction & {
  sourceTransactionId: string;
};

/**
 * Explicit classification boundary. Unknown bank transactions are rejected;
 * they are never guessed into an investment position.
 */
export function classifyMoneyTransaction(
  transaction: MoneyTransaction,
  classification: TransactionClassification,
): ClassifiedMoneyTransaction {
  if (!transaction.id || classification.quantity <= 0 || classification.unitPrice.amount < 0) {
    throw new Error('CAPITAL_TRANSACTION_INVALID');
  }
  return {
    id: `capital-${transaction.id}`,
    sourceTransactionId: transaction.id,
    accountId: transaction.accountId,
    instrument: classification.instrument,
    domain: classification.domain,
    side: classification.side,
    quantity: classification.quantity,
    unitPrice: classification.unitPrice,
    occurredAt: transaction.occurredAt,
  };
}
