import type { SportsEvent, SportsEventPhase, SportsObservationClass, SportsParticipant } from './sports-event.js';
import { freezeSportsEvent } from './sports-event.js';

export type SportsReconciliationStatus = 'CANONICAL' | 'CONFLICT' | 'QUARANTINED';

export interface SportsSourceTrust {
  sourceId: string;
  priority: number;
}

export interface SportsFieldCandidate {
  sourceId: string;
  eventId: string;
  value: unknown;
  evidenceIds: readonly string[];
  confidence: number;
}

export interface SportsReconciledField {
  value: unknown;
  sourceId: string;
  evidenceIds: readonly string[];
  status: SportsReconciliationStatus;
  candidates: readonly SportsFieldCandidate[];
}

export interface SportsEventReconciliationResult {
  eventId: string;
  status: SportsReconciliationStatus;
  fields: Readonly<Record<string, SportsReconciledField>>;
  conflicts: readonly string[];
  sourceIds: readonly string[];
}

export interface CanonicalSportsEventOptions {
  eventId?: string;
  sequence?: number;
  eventType?: string;
  phase?: SportsEventPhase;
  period?: number;
  clockSecondsRemaining?: number;
  participants?: readonly SportsParticipant[];
  observationClass?: SportsObservationClass;
  confidence?: number;
}

function stableValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`).join(',')}}`;
}

function candidateRank(candidate: SportsFieldCandidate, trust: Map<string, number>): [number, number, string] {
  return [trust.get(candidate.sourceId) ?? 0, candidate.confidence, candidate.sourceId];
}

function compareCandidates(a: SportsFieldCandidate, b: SportsFieldCandidate, trust: Map<string, number>): number {
  const ar = candidateRank(a, trust);
  const br = candidateRank(b, trust);
  return br[0] - ar[0] || br[1] - ar[1] || ar[2].localeCompare(br[2]);
}

export class SportsEventReconciler {
  private readonly trust: Map<string, number>;

  constructor(policies: readonly SportsSourceTrust[]) {
    this.trust = new Map(policies.map((policy) => [policy.sourceId, policy.priority]));
  }

  reconcile(events: readonly SportsEvent[], eventId = events[0]?.eventId): SportsEventReconciliationResult {
    if (!eventId?.trim()) throw new Error('Sports event reconciliation requires an event ID');
    const candidates = events.filter((event) => event.eventId === eventId);
    if (!candidates.length) throw new Error(`No sports events found for ${eventId}`);

    const fields = new Map<string, SportsFieldCandidate[]>();
    for (const event of candidates) {
      for (const [field, value] of Object.entries(event.payload)) {
        const list = fields.get(field) ?? [];
        list.push({
          sourceId: event.provenance.source.sourceId,
          eventId: event.eventId,
          value,
          evidenceIds: event.provenance.evidenceIds,
          confidence: event.confidence,
        });
        fields.set(field, list);
      }
    }

    const reconciled: Record<string, SportsReconciledField> = {};
    const conflicts: string[] = [];
    for (const [field, candidatesForField] of fields) {
      const groups = new Map<string, SportsFieldCandidate[]>();
      for (const candidate of candidatesForField) {
        const key = stableValue(candidate.value);
        const group = groups.get(key) ?? [];
        group.push(candidate);
        groups.set(key, group);
      }

      const rankedGroups = [...groups.entries()].sort((a, b) => {
        const aBest = [...a[1]].sort((x, y) => compareCandidates(x, y, this.trust))[0];
        const bBest = [...b[1]].sort((x, y) => compareCandidates(x, y, this.trust))[0];
        return compareCandidates(aBest, bBest, this.trust) || b[1].length - a[1].length;
      });
      const top = rankedGroups[0];
      const topCandidate = [...top[1]].sort((a, b) => compareCandidates(a, b, this.trust))[0];
      const second = rankedGroups[1];
      const secondCandidate = second ? [...second[1]].sort((a, b) => compareCandidates(a, b, this.trust))[0] : undefined;
      const unresolved = !!second && secondCandidate &&
        (candidateRank(topCandidate, this.trust)[0] === candidateRank(secondCandidate, this.trust)[0]) &&
        (candidateRank(topCandidate, this.trust)[1] === candidateRank(secondCandidate, this.trust)[1]);

      const allCandidates = candidatesForField.slice().sort((a, b) => compareCandidates(a, b, this.trust));
      const evidenceIds = [...new Set(allCandidates.flatMap((candidate) => candidate.evidenceIds))].sort();
      reconciled[field] = {
        value: unresolved ? undefined : topCandidate.value,
        sourceId: unresolved ? 'UNRESOLVED' : topCandidate.sourceId,
        evidenceIds,
        status: unresolved ? 'CONFLICT' : 'CANONICAL',
        candidates: Object.freeze(allCandidates),
      };
      if (unresolved) conflicts.push(field);
    }

    const status: SportsReconciliationStatus = conflicts.length ? 'CONFLICT' : 'CANONICAL';
    return Object.freeze({
      eventId,
      status,
      fields: Object.freeze(reconciled),
      conflicts: Object.freeze(conflicts.sort()),
      sourceIds: Object.freeze([...new Set(candidates.map((event) => event.provenance.source.sourceId))].sort()),
    });
  }

  canonicalize(events: readonly SportsEvent[], options: CanonicalSportsEventOptions = {}): SportsEvent {
    if (!events.length) throw new Error('Cannot canonicalize an empty sports event set');
    const first = events[0];
    const result = this.reconcile(events, options.eventId ?? first.eventId);
    if (result.status !== 'CANONICAL') throw new Error(`Sports event ${result.eventId} is not canonical: ${result.conflicts.join(', ')}`);

    const payload: Record<string, unknown> = {};
    for (const [field, resolved] of Object.entries(result.fields)) payload[field] = resolved.value;
    const evidenceIds = [...new Set(Object.values(result.fields).flatMap((field) => field.evidenceIds))].sort();
    const preferred = events.slice().sort((a, b) => {
      const ap = this.trust.get(a.provenance.source.sourceId) ?? 0;
      const bp = this.trust.get(b.provenance.source.sourceId) ?? 0;
      return bp - ap || b.confidence - a.confidence || a.eventId.localeCompare(b.eventId);
    })[0];

    return freezeSportsEvent({
      ...preferred,
      eventId: options.eventId ?? preferred.eventId,
      sequence: options.sequence ?? preferred.sequence,
      eventType: options.eventType ?? preferred.eventType,
      phase: options.phase ?? preferred.phase,
      period: options.period ?? preferred.period,
      clockSecondsRemaining: options.clockSecondsRemaining ?? preferred.clockSecondsRemaining,
      participants: options.participants ?? preferred.participants,
      payload,
      observationClass: options.observationClass ?? 'VALIDATED',
      confidence: options.confidence ?? Math.min(...events.map((event) => event.confidence)),
      provenance: {
        evidenceIds,
        source: {
          sourceId: 'sports-reconciler',
          sourceType: 'SYSTEM',
          observedAt: preferred.provenance.source.observedAt,
          receivedAt: preferred.provenance.source.receivedAt,
        },
        derivedFromEventIds: Object.freeze(events.map((event) => event.eventId)),
      },
    });
  }
}
