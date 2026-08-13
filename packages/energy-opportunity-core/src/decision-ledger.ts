import type { MiningDecisionRecord } from './economic-decision';

export interface MiningDecisionLedger {
  append(record: MiningDecisionRecord): Promise<void>;
}

/**
 * Persistence boundary for advisory mining decisions.
 * Implementations must be append-only and idempotent by decisionId.
 */
export class InMemoryMiningDecisionLedger implements MiningDecisionLedger {
  private readonly records = new Map<string, MiningDecisionRecord>();

  async append(record: MiningDecisionRecord): Promise<void> {
    if (!this.records.has(record.decisionId)) {
      this.records.set(record.decisionId, record);
    }
  }

  list(): MiningDecisionRecord[] {
    return [...this.records.values()];
  }
}
