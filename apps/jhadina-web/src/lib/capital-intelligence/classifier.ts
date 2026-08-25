import type { MoneyTransaction } from '@jhadina/money-core';
import type { TransactionClassification } from './money-transactions';

export type ClassificationCandidate = TransactionClassification & {
  confidence: number;
  reason: string;
};

export type ClassificationResult = {
  status: 'classified' | 'unresolved';
  candidate?: ClassificationCandidate;
};

const patterns: Array<{ domain: TransactionClassification['domain']; pattern: RegExp; instrument: string; reason: string }> = [
  { domain: 'equities', pattern: /\bAAPL\b/i, instrument: 'AAPL', reason: 'explicit ticker in transaction description' },
  { domain: 'equities', pattern: /\bMSFT\b/i, instrument: 'MSFT', reason: 'explicit ticker in transaction description' },
  { domain: 'crypto', pattern: /\bBTC\b|BITCOIN/i, instrument: 'BTC', reason: 'explicit crypto asset in transaction description' },
  { domain: 'crypto', pattern: /\bETH\b|ETHEREUM/i, instrument: 'ETH', reason: 'explicit crypto asset in transaction description' },
];

/**
 * Conservative first-pass classifier. It only promotes an event when the
 * description contains an explicit, unambiguous instrument. Everything else
 * remains unresolved for human/provider enrichment.
 */
export function classifyTransactionCandidate(tx: MoneyTransaction): ClassificationResult {
  const description = tx.description ?? '';
  const matched = patterns.filter((entry) => entry.pattern.test(description));
  if (matched.length !== 1) return { status: 'unresolved' };

  const entry = matched[0];
  const side: TransactionClassification['side'] = tx.amount < 0 ? 'buy' : 'sell';
  const quantity = 1;
  const unitPrice = { amount: Math.abs(tx.amount), currency: tx.currency };

  return {
    status: 'classified',
    candidate: {
      domain: entry.domain,
      instrument: entry.instrument,
      side,
      quantity,
      unitPrice,
      confidence: 0.8,
      reason: entry.reason,
    },
  };
}
