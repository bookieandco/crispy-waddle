import type {
  EvidenceConflict,
  EvidenceRef,
  RealityState,
  ReconciledField,
} from './contracts.js';
import type { EvidenceRecord, EvidenceStore } from './evidence-store.js';
import { validateRealityState } from './validation.js';

export interface SourceTrustPolicy {
  sourceId: string;
  priority: number;
}

export interface ReconciliationResult {
  fields: Record<string, ReconciledField>;
  conflicts: EvidenceConflict[];
  canonical: boolean;
}

function stableValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`).join(',')}}`;
}

function hashState(fields: Record<string, ReconciledField>, previousStateHash?: string): string {
  const body = Object.keys(fields).sort().map((key) => `${key}:${stableValue(fields[key]?.value)}`).join('|');
  return `${previousStateHash ?? 'genesis'}:${body}`;
}

export class MultiSourceReconciler {
  private readonly priority = new Map<string, number>();

  constructor(policies: readonly SourceTrustPolicy[]) {
    for (const policy of policies) this.priority.set(policy.sourceId, policy.priority);
  }

  reconcile(eventId: string, records: readonly EvidenceRecord[]): ReconciliationResult {
    const world = records.filter((record) => record.eventId === eventId && record.domain === 'WORLD');
    const candidates = new Map<string, EvidenceRecord[]>();

    for (const record of world) {
      for (const field of Object.keys(record.payload)) {
        const list = candidates.get(field) ?? [];
        list.push(record);
        candidates.set(field, list);
      }
    }

    const fields: Record<string, ReconciledField> = {};
    const conflicts: EvidenceConflict[] = [];

    for (const [field, fieldRecords] of candidates) {
      const groups = new Map<string, EvidenceRecord[]>();
      for (const record of fieldRecords) {
        const key = stableValue(record.payload[field]);
        const group = groups.get(key) ?? [];
        group.push(record);
        groups.set(key, group);
      }

      const ranked = [...groups.entries()].sort((a, b) => {
        const aPriority = Math.max(...a[1].map((r) => this.priority.get(r.sourceId) ?? 0));
        const bPriority = Math.max(...b[1].map((r) => this.priority.get(r.sourceId) ?? 0));
        return bPriority - aPriority || b[1].length - a[1].length || a[0].localeCompare(b[0]);
      });

      const top = ranked[0];
      const tied = ranked.length > 1 &&
        (Math.max(...top[1].map((r) => this.priority.get(r.sourceId) ?? 0)) ===
         Math.max(...ranked[1][1].map((r) => this.priority.get(r.sourceId) ?? 0))) &&
        top[1].length === ranked[1][1].length;

      if (ranked.length > 1 && tied) {
        const evidenceIds = ranked.flatMap(([, rs]) => rs.map((r) => r.observationId));
        conflicts.push({ eventId, field, evidenceIds, values: ranked.map(([value]) => JSON.parse(value)) });
        fields[field] = {
          value: undefined,
          evidenceIds,
          sourceId: 'UNRESOLVED',
          status: 'CONFLICT',
        };
        continue;
      }

      fields[field] = {
        value: top[1][0].payload[field],
        evidenceIds: top[1].map((r) => r.observationId),
        sourceId: top[1].slice().sort((a, b) => (this.priority.get(b.sourceId) ?? 0) - (this.priority.get(a.sourceId) ?? 0))[0].sourceId,
        status: 'CANONICAL',
      };
    }

    return { fields, conflicts, canonical: conflicts.length === 0 && Object.keys(fields).length > 0 };
  }
}

export class VersionedRealityStateBuilder {
  constructor(
    private readonly store: EvidenceStore,
    private readonly reconciler: MultiSourceReconciler,
  ) {}

  build(eventId: string, asOf: string, previous?: RealityState): RealityState {
    const cutoff = new Date(asOf).getTime();
    if (!Number.isFinite(cutoff)) throw new Error('RealityState asOf must be a valid ISO datetime');
    if (previous && cutoff <= new Date(previous.asOf).getTime()) {
      throw new Error('RealityState versions must advance monotonically in time');
    }

    const records = this.store.forEvent(eventId).filter((record) =>
      record.domain === 'WORLD' && new Date(record.receivedAt).getTime() <= cutoff,
    );
    const result = this.reconciler.reconcile(eventId, records);
    if (!result.canonical) throw new Error(`World state for ${eventId} is not canonical: unresolved evidence conflict`);

    const worldState: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(result.fields)) worldState[field] = value.value;
    const sourceEvidenceIds = [...new Set(Object.values(result.fields).flatMap((field) => field.evidenceIds))].sort();
    const state: RealityState = {
      eventId,
      stateVersion: (previous?.stateVersion ?? 0) + 1,
      asOf,
      previousStateHash: previous?.stateHash,
      sourceEvidenceIds,
      worldState: Object.freeze(worldState),
      reconciledFields: Object.freeze(result.fields),
      conflicts: Object.freeze(result.conflicts),
      canonical: true,
      stateHash: hashState(result.fields, previous?.stateHash),
    };
    validateRealityState(state);
    return Object.freeze(state);
  }
}

export function evidenceRefs(records: readonly EvidenceRecord[]): EvidenceRef[] {
  return records.map((record) => record.evidence);
}
