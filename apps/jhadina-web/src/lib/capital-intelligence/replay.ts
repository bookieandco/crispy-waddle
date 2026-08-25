import type { MoneyTransaction } from '@jhadina/money-core';
import { applyBuy, matchLotsForSale, type Lot, type Position, type PositionTransaction } from './position';
import { classifyMoneyTransaction, type TransactionClassification } from './money-transactions';

export type { Position } from './position';
export type { PositionTransaction } from './position';

export type ReplayState = {
  positions: Position[];
  lots: Lot[];
  appliedSourceTransactionIds: string[];
};

export type ReplayClassificationResolver = (transaction: MoneyTransaction) => TransactionClassification | undefined;

export type ReplayResult = {
  state: ReplayState;
  applied: string[];
  skipped: string[];
  unresolved: string[];
  errors: Array<{ sourceTransactionId: string; code: string }>;
};

/**
 * Deterministic historical replay. Source transactions are sorted by event time
 * and ID, duplicate source IDs are applied once, and unclassified events remain
 * unresolved instead of being guessed.
 */
export function replayTransactions(
  source: MoneyTransaction[],
  resolveClassification: ReplayClassificationResolver,
  prior: ReplayState = { positions: [], lots: [], appliedSourceTransactionIds: [] },
): ReplayResult {
  const appliedSet = new Set(prior.appliedSourceTransactionIds);
  const positions = prior.positions.map((position) => ({ ...position }));
  const lots = prior.lots.map((lot) => ({ ...lot }));
  const applied: string[] = [];
  const skipped: string[] = [];
  const unresolved: string[] = [];
  const errors: Array<{ sourceTransactionId: string; code: string }> = [];

  const ordered = [...source].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const seen = new Set<string>();

  for (const transaction of ordered) {
    if (seen.has(transaction.id) || appliedSet.has(transaction.id)) {
      skipped.push(transaction.id);
      continue;
    }
    seen.add(transaction.id);

    const classification = resolveClassification(transaction);
    if (!classification) {
      unresolved.push(transaction.id);
      continue;
    }

    try {
      const classified = classifyMoneyTransaction(transaction, classification);
      const index = positions.findIndex((position) => position.accountId === classified.accountId && position.instrument === classified.instrument);

      if (classified.side === 'buy') {
        const result = applyBuy(index >= 0 ? positions[index] : undefined, classified);
        if (index >= 0) positions[index] = result.position;
        else positions.push(result.position);
        lots.push(result.lot);
      } else {
        const relevantLots = lots.filter((lot) => index >= 0 && lot.positionId === positions[index].id && lot.quantity > 0);
        const matches = matchLotsForSale(relevantLots, classified);
        for (const match of matches) {
          const lot = lots.find((candidate) => candidate.id === match.lotId);
          if (lot) lot.quantity -= match.quantity;
        }
        if (index >= 0) {
          const position = positions[index];
          position.quantity -= classified.quantity;
          position.realizedPnl = {
            amount: (position.realizedPnl?.amount ?? 0) + matches.reduce((sum, match) => sum + match.realizedPnl.amount, 0),
            currency: classified.unitPrice.currency,
          };
          if (position.quantity < 0) throw new Error('POSITION_QUANTITY_NEGATIVE');
        } else {
          throw new Error('POSITION_NOT_FOUND');
        }
      }

      appliedSet.add(transaction.id);
      applied.push(transaction.id);
    } catch (error) {
      errors.push({ sourceTransactionId: transaction.id, code: error instanceof Error ? error.message : 'REPLAY_FAILED' });
    }
  }

  return { state: { positions, lots, appliedSourceTransactionIds: [...appliedSet].sort() }, applied, skipped, unresolved, errors };
}
