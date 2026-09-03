import type { PredictionRecord } from './contracts.js';
import { freezePredictionRecord } from './validation.js';

export interface PredictionLedger {
  append(record: PredictionRecord): Readonly<PredictionRecord>;
  get(predictionId: string): Readonly<PredictionRecord> | undefined;
  listByEvent(eventId: string): readonly Readonly<PredictionRecord>[];
}

/**
 * Append-only reference ledger. Production persistence can implement the same
 * interface with Postgres/Supabase and a UNIQUE prediction_id constraint.
 * There is intentionally no update/delete operation.
 */
export class InMemoryPredictionLedger implements PredictionLedger {
  private readonly records = new Map<string, Readonly<PredictionRecord>>();

  append(input: PredictionRecord): Readonly<PredictionRecord> {
    const record = freezePredictionRecord(input);
    if (this.records.has(record.predictionId)) {
      throw new Error(`Prediction ${record.predictionId} already exists and cannot be overwritten`);
    }
    this.records.set(record.predictionId, record);
    return record;
  }

  get(predictionId: string): Readonly<PredictionRecord> | undefined {
    return this.records.get(predictionId);
  }

  listByEvent(eventId: string): readonly Readonly<PredictionRecord>[] {
    return Object.freeze([...this.records.values()].filter((record) => record.eventId === eventId));
  }
}
