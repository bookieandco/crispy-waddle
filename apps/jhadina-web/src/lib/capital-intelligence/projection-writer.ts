import type { Position, Lot, ReplayState } from './replay';

export type ProjectionTransaction = {
  sourceTransactionId: string;
  accountId: string;
  domain: string;
  instrument: string;
  side: 'buy' | 'sell';
  quantity: number;
  unitPrice: number;
  currency: string;
  occurredAt: string;
};

export type ProjectionStore = {
  upsertTransaction: (row: ProjectionTransaction) => void;
  upsertPosition: (row: Position) => void;
  upsertLot: (row: Lot) => void;
};

/**
 * Idempotent persistence adapter. The database enforces uniqueness; this
 * writer only persists an already-validated replay result and never executes
 * a broker, exchange, transfer, deposit, withdrawal, or bet.
 */
export function writeReplayProjection(
  transactions: ProjectionTransaction[],
  state: ReplayState,
  store: ProjectionStore,
): void {
  for (const transaction of transactions) store.upsertTransaction(transaction);
  for (const position of state.positions) store.upsertPosition(position);
  for (const lot of state.lots) store.upsertLot(lot);
}
