import type { PlannedResearchCase } from "./research-planner"
import type { PersistedResearchCase } from "./research-case-persistence-result"

export interface MoneyResearchPersistence {
  saveResearchCase(input: PlannedResearchCase): Promise<PersistedResearchCase>
}
