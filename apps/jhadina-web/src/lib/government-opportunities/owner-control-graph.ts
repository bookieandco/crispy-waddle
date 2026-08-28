import type { OwnerControlRelationship } from './owner-control-intelligence'

export interface OwnerControlTraversal {
  personEntityId: string
  companyEntityIds: string[]
  relationships: OwnerControlRelationship[]
}

/** Builds a deterministic cross-company view for an evidenced person/company graph. */
export function buildOwnerControlTraversal(
  personEntityId: string,
  relationships: OwnerControlRelationship[],
): OwnerControlTraversal {
  const relevant = relationships
    .filter((r) => r.personEntityId === personEntityId)
    .map((r) => ({ ...r, evidenceIds: [...new Set(r.evidenceIds)].sort() }))

  const companyEntityIds = [...new Set(relevant.map((r) => r.companyEntityId))].sort()

  return {
    personEntityId,
    companyEntityIds,
    relationships: relevant.sort((a, b) =>
      `${a.companyEntityId}|${a.role}`.localeCompare(`${b.companyEntityId}|${b.role}`),
    ),
  }
}

/**
 * Returns companies connected to a source company through the same evidenced
 * person/control node. It never creates a relationship from a name-only match.
 */
export function findRelatedCompaniesThroughPerson(
  sourceCompanyEntityId: string,
  relationships: OwnerControlRelationship[],
): string[] {
  const personIds = new Set(
    relationships
      .filter((r) => r.companyEntityId === sourceCompanyEntityId && r.evidenceIds.length > 0)
      .map((r) => r.personEntityId),
  )

  return [...new Set(
    relationships
      .filter((r) => personIds.has(r.personEntityId) && r.evidenceIds.length > 0)
      .map((r) => r.companyEntityId),
  )]
    .filter((id) => id !== sourceCompanyEntityId)
    .sort()
}
