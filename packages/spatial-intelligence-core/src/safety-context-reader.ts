import type {
  AdmittedSpatialContextReader,
  AdmittedSpatialContextRecord,
} from '@jhadina/core-spine';
import type { SpatialContextPackage } from './integration.js';
import { toSafetySpatialIntelligence } from './spatial-consumer-adapters.js';

export interface SafetySpatialPackageProvider {
  read(incidentId: string, at: string): Promise<SpatialContextPackage | undefined>;
}

export class SpatialSafetyContextReader implements AdmittedSpatialContextReader {
  constructor(private readonly provider: SafetySpatialPackageProvider) {}

  async readForSafety(incidentId: string, at: string): Promise<readonly AdmittedSpatialContextRecord[]> {
    const context = await this.provider.read(incidentId, at);
    if (!context) return [];
    const projection = toSafetySpatialIntelligence(context);
    const records = new Map<string, AdmittedSpatialContextRecord>();

    for (const ref of projection.observations) {
      records.set(ref.id, {
        sourceId: ref.source,
        evidenceId: ref.id,
        observedAt: ref.observedAt,
        determination: 'observed',
        kind: 'environment',
        payload: { summary: ref.summary, authority: projection.authority },
      });
    }

    for (const ref of projection.evidence) {
      records.set(ref.id, {
        sourceId: ref.source,
        evidenceId: ref.id,
        observedAt: ref.observedAt,
        determination: 'corroborated',
        kind: 'environment',
        payload: { summary: ref.summary, authority: projection.authority },
      });
    }

    for (const ref of projection.reality) {
      records.set(ref.id, {
        sourceId: ref.source,
        evidenceId: ref.id,
        observedAt: ref.observedAt,
        determination: 'verified',
        kind: 'environment',
        payload: { summary: ref.summary, authority: projection.authority },
      });
    }

    return [...records.values()];
  }
}
