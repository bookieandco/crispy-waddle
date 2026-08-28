import type { ProcurementSource, ProcurementSourceLevel } from './procurement-source-registry'

export interface JurisdictionNode {
  id: string
  level: ProcurementSourceLevel
  name: string
  parentId?: string
  fipsCode?: string
  active: boolean
}

export interface JurisdictionSourceMapping {
  jurisdictionId: string
  sourceIds: string[]
  missingSource: boolean
  unmapped: boolean
}

/** Maps procurement sources to jurisdiction nodes without assuming coverage. */
export function mapJurisdictionSources(
  jurisdictions: JurisdictionNode[],
  sources: ProcurementSource[],
): JurisdictionSourceMapping[] {
  const sourceByJurisdiction = new Map<string, string[]>()

  for (const source of sources) {
    const key = `${source.level}|${source.jurisdiction.trim().toLowerCase()}`
    sourceByJurisdiction.set(key, [
      ...(sourceByJurisdiction.get(key) ?? []),
      source.id,
    ])
  }

  return jurisdictions
    .filter((jurisdiction) => jurisdiction.active)
    .map((jurisdiction) => {
      const key = `${jurisdiction.level}|${jurisdiction.name.trim().toLowerCase()}`
      const sourceIds = [...new Set(sourceByJurisdiction.get(key) ?? [])].sort()
      return {
        jurisdictionId: jurisdiction.id,
        sourceIds,
        missingSource: sourceIds.length === 0,
        unmapped: sourceIds.length === 0,
      }
    })
}

export function findUnmappedJurisdictions(
  mappings: JurisdictionSourceMapping[],
): string[] {
  return mappings.filter((mapping) => mapping.unmapped).map((mapping) => mapping.jurisdictionId).sort()
}
