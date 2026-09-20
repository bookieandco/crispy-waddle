export type ObservationSource = {
  provider: string
  capability: string
  adapterVersion: string
  sourceRef?: string
}

export type ObservationProvenance = {
  observedAt: string
  receivedAt: string
  retrievedAt?: string
  evidenceRefs: readonly string[]
}

export type ObservationLimitations = {
  freshness?: 'live' | 'near-real-time' | 'delayed' | 'historical' | 'unknown'
  limitations: readonly string[]
}

export type ObservationEnvelope<T> = Readonly<{
  observationId: string
  subjectId: string
  source: ObservationSource
  provenance: ObservationProvenance
  payload: T
  limitations: ObservationLimitations
  trustEffect: 'NONE'
  authorizationEffect: 'NONE'
}>

export function createObservationEnvelope<T>(input: {
  observationId: string
  subjectId: string
  source: ObservationSource
  provenance: ObservationProvenance
  payload: T
  limitations?: Partial<ObservationLimitations>
}): ObservationEnvelope<T> {
  if (!input.observationId.trim()) throw new Error('OBSERVATION_ID_REQUIRED')
  if (!input.subjectId.trim()) throw new Error('OBSERVATION_SUBJECT_REQUIRED')
  if (!input.source.provider.trim() || !input.source.capability.trim() || !input.source.adapterVersion.trim()) {
    throw new Error('OBSERVATION_SOURCE_REQUIRED')
  }
  if (!input.provenance.observedAt || !input.provenance.receivedAt) throw new Error('OBSERVATION_PROVENANCE_REQUIRED')
  if (!Number.isFinite(Date.parse(input.provenance.observedAt)) || !Number.isFinite(Date.parse(input.provenance.receivedAt))) {
    throw new Error('OBSERVATION_PROVENANCE_TIMESTAMP_INVALID')
  }
  if (input.provenance.retrievedAt !== undefined && !Number.isFinite(Date.parse(input.provenance.retrievedAt))) {
    throw new Error('OBSERVATION_PROVENANCE_TIMESTAMP_INVALID')
  }

  return Object.freeze({
    observationId: input.observationId,
    subjectId: input.subjectId,
    source: Object.freeze({ ...input.source }),
    provenance: Object.freeze({ ...input.provenance, evidenceRefs: Object.freeze([...(input.provenance.evidenceRefs ?? [])]) }),
    payload: input.payload,
    limitations: Object.freeze({
      freshness: input.limitations?.freshness ?? 'unknown',
      limitations: Object.freeze([...(input.limitations?.limitations ?? [])]),
    }),
    trustEffect: 'NONE' as const,
    authorizationEffect: 'NONE' as const,
  })
}
