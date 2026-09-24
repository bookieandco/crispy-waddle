import type { EvidenceRef, RealityState } from './contracts.js';
import { validateEvidence, validateRealityState } from './validation.js';

export interface RawSportsObservation {
  observationId: string;
  eventId: string;
  sourceId: string;
  domain: 'WORLD' | 'MARKET';
  observedAt: string;
  receivedAt: string;
  payload: Readonly<Record<string, unknown>>;
  contentHash: string;
}

export interface EvidenceRecord extends RawSportsObservation {
  evidence: EvidenceRef;
}

export interface EvidenceStore {
  append(observation: RawSportsObservation): EvidenceRecord;
  get(observationId: string): EvidenceRecord | undefined;
  forEvent(eventId: string): readonly EvidenceRecord[];
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly records = new Map<string, EvidenceRecord>();

  append(observation: RawSportsObservation): EvidenceRecord {
    if (this.records.has(observation.observationId)) {
      throw new Error(`Evidence observation ${observation.observationId} already exists`);
    }
    const evidence: EvidenceRef = {
      evidenceId: observation.observationId,
      sourceId: observation.sourceId,
      domain: observation.domain,
      observedAt: observation.observedAt,
      receivedAt: observation.receivedAt,
      quality: 'UNKNOWN',
      contentHash: observation.contentHash,
    };
    validateEvidence(evidence);
    const record: EvidenceRecord = Object.freeze({
      ...observation,
      payload: Object.freeze({ ...observation.payload }),
      evidence: Object.freeze(evidence),
    });
    this.records.set(record.observationId, record);
    return record;
  }

  get(observationId: string): EvidenceRecord | undefined {
    return this.records.get(observationId);
  }

  forEvent(eventId: string): readonly EvidenceRecord[] {
    return Object.freeze([...this.records.values()].filter((record) => record.eventId === eventId));
  }
}

export interface RealityStateBuilder {
  build(eventId: string, asOf: string): RealityState;
}

export class EvidenceBackedRealityStateBuilder implements RealityStateBuilder {
  constructor(private readonly store: EvidenceStore) {}

  build(eventId: string, asOf: string): RealityState {
    const cutoff = new Date(asOf).getTime();
    if (!Number.isFinite(cutoff)) throw new Error('RealityState asOf must be a valid ISO datetime');

    const records = this.store
      .forEvent(eventId)
      .filter((record) => new Date(record.receivedAt).getTime() <= cutoff)
      .sort((a, b) => {
        const time = new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime();
        return time || a.observationId.localeCompare(b.observationId);
      });

    if (!records.length) throw new Error(`No evidence available for event ${eventId} at ${asOf}`);

    const worldRecords = records.filter((record) => record.domain === 'WORLD');
    if (!worldRecords.length) throw new Error('RealityState requires world-domain evidence');

    const worldState: Record<string, unknown> = {};
    for (const record of worldRecords) {
      Object.assign(worldState, record.payload);
    }

    const state: RealityState = {
      eventId,
      stateVersion: 1,
      asOf,
      sourceEvidenceIds: worldRecords.map((record) => record.observationId),
      worldState: Object.freeze(worldState),
      canonical: true,
      stateHash: worldRecords.map((record) => record.contentHash).join(':') || 'empty',
    };
    validateRealityState(state);
    return Object.freeze(state);
  }
}
