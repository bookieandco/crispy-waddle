import type { ResearchBranchStatus } from "./research-case"

export function researchTaskPriority(status: ResearchBranchStatus): number {
  switch (status) {
    case "READY":
      return 10
    case "PENDING":
      return 50
    case "BLOCKED":
      return 90
    case "COMPLETE":
      return 100
  }
}

/**
 * Existing READY work stays READY on an upsert. A later planner run must not
 * accidentally demote actionable research back to PENDING.
 */
export function preserveResearchTaskState(input: {
  existingStatus?: ResearchBranchStatus
  plannedStatus: ResearchBranchStatus
}): { status: ResearchBranchStatus; priority: number } {
  const status = input.existingStatus === "READY"
    ? "READY"
    : input.plannedStatus

  return { status, priority: researchTaskPriority(status) }
}
