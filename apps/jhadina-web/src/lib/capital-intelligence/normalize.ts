import type { MoneyTransaction } from '@jhadina/money-core';
import type { CanonicalCapitalEvent, CapitalEventKind } from './taxonomy';
import { classifyTransactionCandidate } from './classifier';

export function normalizeCapitalEvent(tx: MoneyTransaction): CanonicalCapitalEvent {
  const candidate = classifyTransactionCandidate(tx);
  if (candidate.status === 'classified' && candidate.candidate) {
    const c = candidate.candidate;
    const kind: CapitalEventKind = c.side === 'buy' ? 'acquisition' : 'disposition';
    return {
      sourceTransactionId: tx.id,
      accountId: tx.accountId,
      asset: { domain: c.domain, instrument: c.instrument, quoteCurrency: tx.currency },
      kind,
      quantity: c.quantity,
      notional: c.unitPrice,
      occurredAt: tx.occurredAt,
      confidence: c.confidence,
      classificationReason: c.reason,
    };
  }
  return {
    sourceTransactionId: tx.id,
    accountId: tx.accountId,
    kind: 'unknown',
    notional: { amount: Math.abs(tx.amount), currency: tx.currency },
    occurredAt: tx.occurredAt,
    confidence: 0,
    classificationReason: 'No unambiguous capital instrument identified',
  };
}
