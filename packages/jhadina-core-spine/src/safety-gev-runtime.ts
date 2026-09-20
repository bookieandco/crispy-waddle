import type { SafetySpatialContextProvider, SafetySpatialSignal, SafetySpatialSnapshot } from './safety-spatial-context.js';

export interface AdmittedSpatialContextRecord {
  readonly sourceId: string;
  readonly evidenceId?: string;
  readonly observedAt: string;
  readonly determination: 'observed' | 'corroborated' | 'verified' | 'derived';
  readonly kind: SafetySpatialSignal['kind'];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface AdmittedSpatialContextReader {
  readForSafety(incidentId: string, at: string): Promise<readonly AdmittedSpatialContextRecord[]>;
}

export class GevSafetySpatialContextProvider implements SafetySpatialContextProvider {
  constructor(private readonly reader: AdmittedSpatialContextReader) {}

  async snapshot(incidentId: string, at: string): Promise<SafetySpatialSnapshot> {
    const records = await this.reader.readForSafety(incidentId, at);
    return {
      incidentId,
      createdAt: at,
      signals: records.map((record) => ({
        sourceId: record.sourceId,
        evidenceId: record.evidenceId,
        observedAt: record.observedAt,
        evidenceClass: record.determination === 'derived' ? 'inferred' : record.determination === 'verified' ? 'admitted-reality' : 'observed',
        kind: record.kind,
        payload: record.payload,
      })),
    };
  }
}
