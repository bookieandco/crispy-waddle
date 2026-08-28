import type { PlannedResearchCase } from "./research-planner"

export interface MoneyResearchTaskPersistence {
  upsertResearchTask(input: {
    researchCaseId: string
    branch: PlannedResearchCase["branches"][number]
    priority: number
  }): Promise<{ id: string }>
}
