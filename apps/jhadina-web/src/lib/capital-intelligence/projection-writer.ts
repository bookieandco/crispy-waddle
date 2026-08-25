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
  upsertTransaction: (row: ProjectionTransaction) => Promise<void>;
  upsertPosition: (row: Position) => Promise<void>;
  upsertLot: (row: Lot) => Promise<void>;
};

/** Idempotent persistence adapter; execution is explicitly out of scope. */
export async function writeReplayProjection(
  transactions: ProjectionTransaction[],
  state: ReplayState,
  store: ProjectionStore,
): Promise<void> {
  for (const transaction of transactions) await store.upsertTransaction(transaction);
  for (const position of state.positions) await store.upsertPosition(position);
  for (const lot of state.lots) await store.upsertLot(lot);
}
