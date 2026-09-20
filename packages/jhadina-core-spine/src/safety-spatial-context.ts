export type SafetySpatialEvidenceClass = 'observed' | 'admitted-reality' | 'inferred';

export interface SafetySpatialSignal {
  readonly sourceId: string;
  readonly evidenceId?: string;
  readonly observedAt: string;
  readonly evidenceClass: SafetySpatialEvidenceClass;
  readonly kind: 'position' | 'movement' | 'connectivity' | 'environment' | 'public-alert' | 'device';
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface SafetySpatialSnapshot {
  readonly incidentId: string;
  readonly createdAt: string;
  readonly signals: readonly SafetySpatialSignal[];
}

/** Read-only GEV bridge. Spatial context can inform policy inputs but cannot authorize actions. */
export interface SafetySpatialContextProvider {
  snapshot(incidentId: string, at: string): Promise<SafetySpatialSnapshot>;
}
