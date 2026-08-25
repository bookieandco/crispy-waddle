import type { Position, Lot } from './position';
import type { ProjectionStore, ProjectionTransaction } from './projection-writer';

export type SupabaseLike = {
  from: (table: string) => {
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/** Server-side persistence adapter only. It performs projections, never financial execution. */
export function createSupabaseProjectionStore(db: SupabaseLike): ProjectionStore {
  return {
    upsertTransaction: (row: ProjectionTransaction) => {
      void db.from('jhadina_capital_transaction_projection').upsert({
        source_transaction_id: row.sourceTransactionId,
        account_id: row.accountId,
        domain: row.domain,
        instrument: row.instrument,
        side: row.side,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        currency: row.currency,
        occurred_at: row.occurredAt,
        replayed_at: new Date().toISOString(),
      }, { onConflict: 'source_transaction_id' });
    },
    upsertPosition: (row: Position) => {
      void db.from('jhadina_capital_position_projection').upsert({
        id: row.id,
        account_id: row.accountId,
        domain: row.domain,
        instrument: row.instrument,
        quantity: row.quantity,
        average_cost: row.averageCost.amount,
        currency: row.averageCost.currency,
        realized_pnl: row.realizedPnl?.amount ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,instrument' });
    },
    upsertLot: (row: Lot) => {
      void db.from('jhadina_capital_lot_projection').upsert({
        id: row.id,
        position_id: row.positionId,
        source_transaction_id: row.sourceTransactionId,
        quantity: row.quantity,
        remaining_quantity: row.quantity,
        unit_cost: row.unitCost.amount,
        currency: row.unitCost.currency,
        acquired_at: row.acquiredAt,
      }, { onConflict: 'source_transaction_id' });
    },
  };
}
