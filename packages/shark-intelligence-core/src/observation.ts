export type SharkObservationSource =
  | 'onchain'
  | 'market'
  | 'social'
  | 'community'
  | 'research'
  | 'system'

export type SharkObservation = {
  id: string
  opportunityId: string
  sourceId: string
  source: SharkObservationSource
  observedAt: string
  signal: string
  value?: number
  unit?: string
  confidence: number
  verified: boolean
  metadata?: Record<string, string | number | boolean | null>
}

export function validateSharkObservation(observation: SharkObservation): string[] {
  const errors: string[] = []
  if (!observation.id) errors.push('id is required')
  if (!observation.opportunityId) errors.push('opportunityId is required')
  if (!observation.sourceId) errors.push('sourceId is required')
  if (!observation.observedAt) errors.push('observedAt is required')
  if (!observation.signal) errors.push('signal is required')
  if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) {
    errors.push('confidence must be between 0 and 1')
  }
  if (observation.value !== undefined && !Number.isFinite(observation.value)) errors.push('value must be finite')
  return errors
}

export function createSharkObservation(input: Omit<SharkObservation, 'id'> & { id?: string }): SharkObservation {
  const observation: SharkObservation = {
    ...input,
    id: input.id ?? `shark-observation:${input.opportunityId}:${input.sourceId}:${input.observedAt}`,
  }
  const errors = validateSharkObservation(observation)
  if (errors.length) throw new Error(`invalid Shark observation: ${errors.join(', ')}`)
  return {
    ...observation,
    metadata: observation.metadata ? { ...observation.metadata } : undefined,
  }
}
