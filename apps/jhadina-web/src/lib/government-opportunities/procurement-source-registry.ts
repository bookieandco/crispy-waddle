export type ProcurementSourceLevel = 'FEDERAL' | 'STATE' | 'COUNTY' | 'CITY' | 'SCHOOL_DISTRICT' | 'SPECIAL_DISTRICT' | 'AGENCY'

export interface ProcurementSource {
  id: string
  name: string
  level: ProcurementSourceLevel
  jurisdiction: string
  url: string
  sourceType: 'portal' | 'bid_board' | 'vendor_registry' | 'api' | 'feed'
  active: boolean
  capabilities?: string[]
  lastVerifiedAt?: string
  metadata?: Record<string, unknown>
}

export interface ProcurementSourceRegistry {
  sources: ProcurementSource[]
  byLevel: Partial<Record<ProcurementSourceLevel, string[]>>
  byJurisdiction: Record<string, string[]>
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/** Canonicalizes procurement discovery endpoints without performing network access. */
export function buildProcurementSourceRegistry(
  sources: ProcurementSource[],
): ProcurementSourceRegistry {
  const deduped = new Map<string, ProcurementSource>()

  for (const source of sources) {
    if (!source.id || !source.url || !source.name || !source.jurisdiction) continue
    const normalized: ProcurementSource = {
      ...source,
      jurisdiction: source.jurisdiction.trim(),
      capabilities: source.capabilities?.map((value) => value.trim()).filter(Boolean),
    }
    deduped.set(source.id, normalized)
  }

  const canonical = [...deduped.values()].sort((a, b) => a.id.localeCompare(b.id))
  const byLevel: Partial<Record<ProcurementSourceLevel, string[]>> = {}
  const byJurisdiction: Record<string, string[]> = {}

  for (const source of canonical) {
    byLevel[source.level] = [...(byLevel[source.level] ?? []), source.id].sort()
    const jurisdictionKey = normalize(source.jurisdiction)
    byJurisdiction[jurisdictionKey] = [...(byJurisdiction[jurisdictionKey] ?? []), source.id].sort()
  }

  return { sources: canonical, byLevel, byJurisdiction }
}

export function findProcurementSources(
  registry: ProcurementSourceRegistry,
  filters: { level?: ProcurementSourceLevel; jurisdiction?: string; activeOnly?: boolean },
): ProcurementSource[] {
  return registry.sources.filter((source) =>
    (!filters.level || source.level === filters.level) &&
    (!filters.jurisdiction || normalize(source.jurisdiction) === normalize(filters.jurisdiction)) &&
    (!filters.activeOnly || source.active),
  )
}
