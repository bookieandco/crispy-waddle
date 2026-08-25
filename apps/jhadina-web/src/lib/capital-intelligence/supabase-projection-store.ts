import type { Position, Lot } from './position';
import type { ProjectionStore, ProjectionTransaction } from './projection-writer';

export type SupabaseLike = {
  from: (table: string) => {
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
  };
};

/** Server-side persistence adapter only. It performs projections, never financial execution. */
export function createSupabaseProjectionStore(db: SupabaseLike): ProjectionStore {
  return {
    upsertTransaction: async (row: ProjectionTransaction) => {
      const { error } = await db.from('jhadina_capital_transaction_projection').upsert({
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
      if (error) throw new Error(`CAPITAL_PROJECTION_TRANSACTION_WRITE_FAILED:${error.message}`);
    },
    upsertPosition: async (row: Position) => {
      const { error } = await db.from('jhadina_capital_position_projection').upsert({
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
      if (error) throw new Error(`CAPITAL_PROJECTION_POSITION_WRITE_FAILED:${error.message}`);
    },
    upsertLot: async (row: Lot) => {
      const { error } = await db.from('jhadina_capital_lot_projection').upsert({
        id: row.id,
        position_id: row.positionId,
        source_transaction_id: row.sourceTransactionId,
        quantity: row.quantity,
        remaining_quantity: row.quantity,
        unit_cost: row.unitCost.amount,
        currency: row.unitCost.currency,
        acquired_at: row.acquiredAt,
      }, { onConflict: 'source_transaction_id' });
      if (error) throw new Error(`CAPITAL_PROJECTION_LOT_WRITE_FAILED:${error.message}`);
    },
  };
}
