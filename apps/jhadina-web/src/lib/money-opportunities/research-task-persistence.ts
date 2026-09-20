import type { ResearchBranch } from "./research-case"

export interface MoneyResearchTaskPersistence {
  upsertResearchTask(input: {
    researchCaseId: string
    branch: ResearchBranch
    priority: number
  }): Promise<{ id: string }>
}

export async function persistResearchTask(
  persistence: MoneyResearchTaskPersistence,
  input: {
    researchCaseId: string
    branch: ResearchBranch
    priority: number
  },
): Promise<{ id: string }> {
  return persistence.upsertResearchTask(input)
}
