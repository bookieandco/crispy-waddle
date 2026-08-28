import type { PlannedResearchCase } from "./research-planner"
import { persistedResearchCaseResult, type PersistedResearchCase } from "./research-case-persistence-result"

export interface MoneyResearchPersistence {
  saveResearchCase(input: PlannedResearchCase): Promise<PersistedResearchCase>
}

/**
 * Keeps the money-opportunity domain independent from the database client.
 * The Supabase implementation can be supplied by the server route/worker.
 */
export async function persistPlannedResearchCase(
  persistence: MoneyResearchPersistence,
  input: PlannedResearchCase,
): Promise<PersistedResearchCase> {
  const result = await persistence.saveResearchCase(input)
  return persistedResearchCaseResult(result)
}
