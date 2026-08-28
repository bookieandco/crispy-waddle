import type { ResearchBranchStatus } from "./research-case"

export function researchTaskPriority(status: ResearchBranchStatus): number {
  return status === "READY" ? 10 : 50
}

export function preserveResearchTaskState(input: { existingStatus?: ResearchBranchStatus; plannedStatus: ResearchBranchStatus }) {
  if (input.existingStatus === "READY" && input.plannedStatus === "PENDING") {
    return { status: "READY" as const, priority: 10 }
  }
  return { status: input.plannedStatus, priority: researchTaskPriority(input.plannedStatus) }
}
