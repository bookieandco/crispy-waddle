export type EntityKind =
  | 'STATE'
  | 'COUNTY'
  | 'MUNICIPALITY'
  | 'SCHOOL_DISTRICT'
  | 'UNIVERSITY'
  | 'TRANSIT'
  | 'AIRPORT'
  | 'PORT'
  | 'UTILITY'
  | 'HOUSING_AUTHORITY'
  | 'HEALTH_SYSTEM'
  | 'SPECIAL_DISTRICT'

export type EntityCandidate = {
  id: string
  name: string
  kind: EntityKind
  country: string
  state?: string
  county?: string
  municipality?: string
  parentId?: string
  sourceUrl?: string
}

export type EntityResolution = {
  entity: EntityCandidate
  confidence: number
  reasons: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Resolve a discovered entity candidate without inventing jurisdictional facts. */
export function resolveEntity(candidate: EntityCandidate, signals: {
  nameMatch?: number
  jurisdictionMatch?: number
  sourceAuthority?: number
  parentMatch?: number
} = {}): EntityResolution {
  const nameMatch = clamp(signals.nameMatch ?? 0)
  const jurisdictionMatch = clamp(signals.jurisdictionMatch ?? 0)
  const sourceAuthority = clamp(signals.sourceAuthority ?? 0)
  const parentMatch = clamp(signals.parentMatch ?? 0)

  const confidence = Math.round(
    nameMatch * 0.30 +
      jurisdictionMatch * 0.30 +
      sourceAuthority * 0.25 +
      parentMatch * 0.15,
  )

  const reasons: string[] = []
  if (nameMatch >= 80) reasons.push('strong entity-name match')
  if (jurisdictionMatch >= 80) reasons.push('strong jurisdiction match')
  if (sourceAuthority >= 80) reasons.push('authoritative source')
  if (parentMatch >= 80) reasons.push('parent-jurisdiction match')

  return { entity: candidate, confidence, reasons }
}
