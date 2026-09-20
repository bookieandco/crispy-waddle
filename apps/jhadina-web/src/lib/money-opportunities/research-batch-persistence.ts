import type { PlannedResearchCase } from "./research-planner"
import type { PersistedResearchCase } from "./research-case-persistence-result"
import type { MoneyResearchPersistence } from "./research-persistence"

export interface MoneyResearchBatchPersistence extends MoneyResearchPersistence {
  saveResearchCases(inputs: PlannedResearchCase[]): Promise<PersistedResearchCase[]>
}

export async function persistPlannedResearchCases(
  persistence: MoneyResearchBatchPersistence,
  inputs: PlannedResearchCase[],
): Promise<PersistedResearchCase[]> {
  if (inputs.length === 0) return []
  return persistence.saveResearchCases(inputs)
}
