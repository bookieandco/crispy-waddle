export interface PersistedResearchCase {
  id: string
  opportunityId: string
}

/**
 * The persistence boundary returns the database identity so callers can
 * immediately attach/upsert research tasks and evidence to the same case.
 */
export function persistedResearchCaseResult(input: {
  id: string
  opportunityId: string
}): PersistedResearchCase {
  if (!input.id) throw new Error("Persisted research case id is required")
  if (!input.opportunityId) throw new Error("Opportunity id is required")

  return {
    id: input.id,
    opportunityId: input.opportunityId,
  }
}
