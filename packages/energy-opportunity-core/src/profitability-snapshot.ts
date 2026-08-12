import type { MiningFinancialEvent, MiningProfitabilitySnapshotEvent } from './financial-events.ts';
import type { RealizedProfitability } from './realized-profitability.ts';

export interface ProfitabilitySnapshotInput {
  reconciliation: RealizedProfitability;
  eventIds: readonly string[];
  occurredAt: string;
}

export interface ProfitabilitySnapshotLedger {
  append(event: MiningProfitabilitySnapshotEvent): MiningProfitabilitySnapshotEvent;
  has(eventId: string): boolean;
}

export class InMemoryProfitabilitySnapshotLedger implements ProfitabilitySnapshotLedger {
  private readonly events = new Map<string, MiningProfitabilitySnapshotEvent>();

  append(event: MiningProfitabilitySnapshotEvent): MiningProfitabilitySnapshotEvent {
    const existing = this.events.get(event.eventId);
    if (existing) return existing;
    this.events.set(event.eventId, event);
    return event;
  }

  has(eventId: string): boolean {
    return this.events.has(eventId);
  }
}

function snapshotEventId(input: ProfitabilitySnapshotInput): string {
  const ids = [...input.eventIds].sort().join('|');
  return `mining-profitability-snapshot:${input.reconciliation.resourceId}:${ids || input.occurredAt}`;
}

/** Converts a completed reconciliation into an immutable Money Core financial event. */
export function buildProfitabilitySnapshotEvent(
  input: ProfitabilitySnapshotInput,
): MiningProfitabilitySnapshotEvent | null {
  const { reconciliation } = input;
  if (reconciliation.realizedNetUsd === null) return null;

  return {
    schemaVersion: 1,
    eventId: snapshotEventId(input),
    kind: 'mining_profitability_snapshot',
    resourceId: reconciliation.resourceId,
    occurredAt: input.occurredAt,
    currency: 'USD',
    source: 'money-core',
    immutable: true,
    estimatedGrossUsd: reconciliation.projectedGrossUsd,
    electricityUsd: reconciliation.electricityUsd,
    realizedBtc: reconciliation.verifiedBtc,
    realizedUsd: reconciliation.realizedGrossUsd,
    netUsd: reconciliation.realizedNetUsd,
  };
}

/** Appends a snapshot exactly once; repeated source-event sets return the existing snapshot. */
export function appendProfitabilitySnapshot(
  ledger: ProfitabilitySnapshotLedger,
  input: ProfitabilitySnapshotInput,
): MiningProfitabilitySnapshotEvent | null {
  const event = buildProfitabilitySnapshotEvent(input);
  if (!event) return null;
  return ledger.append(event);
}

export type { MiningFinancialEvent };
