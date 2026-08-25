import type { MoneyTransaction } from '@jhadina/money-core';
import type { PositionTransaction } from './domain';

export type ReconciliationStatus = 'matched' | 'missing-classification' | 'duplicate' | 'invalid';
export type ReconciliationRecord = {
  sourceTransactionId: string;
  status: ReconciliationStatus;
  reason?: string;
};

/**
 * Reconciles the source transaction stream against classified capital events.
 * Money Core remains authoritative; this function only reports projection gaps.
 */
export function reconcileTransactions(
  source: MoneyTransaction[],
  projected: PositionTransaction[],
): ReconciliationRecord[] {
  const sourceIds = new Set(source.map((tx) => tx.id));
  const projectedBySource = new Map<string, PositionTransaction>();
  const results: ReconciliationRecord[] = [];

  for (const tx of projected) {
    const sourceId = tx.id.startsWith('capital-') ? tx.id.slice('capital-'.length) : tx.id;
    if (!sourceIds.has(sourceId)) {
      results.push({ sourceTransactionId: sourceId, status: 'invalid', reason: 'PROJECTED_EVENT_HAS_NO_SOURCE_TRANSACTION' });
      continue;
    }
    if (projectedBySource.has(sourceId)) {
      results.push({ sourceTransactionId: sourceId, status: 'duplicate', reason: 'MULTIPLE_PROJECTED_EVENTS_FOR_SOURCE' });
      continue;
    }
    projectedBySource.set(sourceId, tx);
    results.push({ sourceTransactionId: sourceId, status: 'matched' });
  }

  for (const tx of source) {
    if (!projectedBySource.has(tx.id)) {
      results.push({ sourceTransactionId: tx.id, status: 'missing-classification', reason: 'SOURCE_EVENT_NOT_PROJECTED' });
    }
  }

  return results;
}
