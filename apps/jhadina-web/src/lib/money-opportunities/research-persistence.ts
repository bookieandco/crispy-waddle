import type { PlannedResearchCase } from "./research-planner"

export interface MoneyResearchPersistence {
  saveResearchCase(input: PlannedResearchCase): Promise<{ id: string }>
}

/**
 * Keeps the money-opportunity domain independent from the database client.
 * The Supabase implementation can be supplied by the server route/worker.
 */
export async function persistPlannedResearchCase(
  persistence: MoneyResearchPersistence,
  input: PlannedResearchCase,
): Promise<{ id: string }> {
  return persistence.saveResearchCase(input)
}
