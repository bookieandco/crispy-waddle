export type SourceKind =
  | 'PROCUREMENT_PORTAL'
  | 'AGENCY_NATIVE'
  | 'AWARDS'
  | 'FORECASTS'
  | 'SUBCONTRACTING'
  | 'GRANTS'
  | 'BUDGETS'
  | 'CAPITAL_PLANS'
  | 'PUBLIC_NOTICES'
  | 'AGENDAS'
  | 'REGULATORY'
  | 'LICENSES'

export type SourceAuthority = 'PRIMARY' | 'SECONDARY' | 'DISCOVERY'

export type GovernmentSource = {
  id: string
  name: string
  url: string
  kind: SourceKind
  authority: SourceAuthority
  entityId?: string
}

export type SourceBinding = {
  sourceId: string
  entityId: string
  confidence: number
  evidence: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Bind a discovered source to a canonical government entity using explicit
 * evidence. URL presence alone never proves ownership of a source.
 */
export function bindSourceToEntity(
  source: GovernmentSource,
  entityId: string,
  signals: {
    explicitEntityReference?: number
    domainMatch?: number
    jurisdictionMatch?: number
    sourceAuthority?: number
  } = {},
): SourceBinding {
  const explicit = clamp(signals.explicitEntityReference ?? 0)
  const domain = clamp(signals.domainMatch ?? 0)
  const jurisdiction = clamp(signals.jurisdictionMatch ?? 0)
  const authority = clamp(signals.sourceAuthority ?? 0)

  const confidence = Math.round(
    explicit * 0.40 +
      domain * 0.20 +
      jurisdiction * 0.25 +
      authority * 0.15,
  )

  const evidence: string[] = []
  if (explicit >= 80) evidence.push('source explicitly references entity')
  if (domain >= 80) evidence.push('source domain matches entity footprint')
  if (jurisdiction >= 80) evidence.push('source jurisdiction matches entity')
  if (authority >= 80) evidence.push('source has strong authority signal')

  return { sourceId: source.id, entityId, confidence, evidence }
}
