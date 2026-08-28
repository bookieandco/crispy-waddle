import { describe, expect, it, vi } from "vitest"
import { SupabaseMoneyResearchPersistence } from "./supabase-research-persistence"
import type { PlannedResearchCase } from "./research-planner"

function makeInput(): PlannedResearchCase {
  const kinds = [
    "AGENCY", "REQUIREMENTS", "INCUMBENT", "COMPETITORS",
    "PARTNERS", "ECONOMICS", "NEXT_ACTION",
  ] as const

  return {
    id: "case-template",
    opportunityId: "SAM-REGRESSION-001",
    source: "sam.gov",
    title: "Regression opportunity",
    action: "BID_NOW",
    priority: "HIGH",
    estimatedValue: 100000,
    estimatedMarginPercent: 25,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    focusBranches: ["AGENCY", "REQUIREMENTS", "INCUMBENT", "COMPETITORS", "ECONOMICS", "NEXT_ACTION"],
    branches: kinds.map((kind) => ({
      kind,
      question: `Research ${kind}`,
      status: kind === "REQUIREMENTS" ? "READY" : "PENDING",
    })),
  }
}

describe("SupabaseMoneyResearchPersistence", () => {
  it("persists one case and seven tasks across repeated pulls and preserves READY", async () => {
    const caseRow = { id: "case-1", opportunity_id: "SAM-REGRESSION-001" }
    const taskRows = new Map<string, { id: string; status: string; priority: number }>()

    const from = vi.fn((table: string) => ({
      upsert: vi.fn((values: Record<string, unknown>) => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            if (table === "money_research_cases") return { data: caseRow, error: null }
            const branch = String(values.branch)
            const existing = taskRows.get(branch)
            const row = existing || { id: `task-${taskRows.size + 1}`, status: "PENDING", priority: 50 }
            if (existing?.status === "READY" && values.status === "PENDING") {
              values.status = "READY"
              values.priority = 10
            }
            row.status = String(values.status)
            row.priority = Number(values.priority)
            taskRows.set(branch, row)
            return { data: { id: row.id }, error: null }
          }),
        })),
      })),
    }))

    const persistence = new SupabaseMoneyResearchPersistence({ from })
    const input = makeInput()

    await persistence.saveResearchCase(input)
    const firstReadyId = taskRows.get("REQUIREMENTS")?.id
    taskRows.get("REQUIREMENTS")!.status = "READY"
    taskRows.get("REQUIREMENTS")!.priority = 10

    await persistence.saveResearchCase({
      ...input,
      branches: input.branches.map((branch) => ({ ...branch, status: "PENDING" })),
    })

    expect(caseRow.id).toBe("case-1")
    expect(taskRows.size).toBe(7)
    expect(taskRows.get("REQUIREMENTS")?.id).toBe(firstReadyId)
    expect(taskRows.get("REQUIREMENTS")?.status).toBe("READY")
    expect(taskRows.get("REQUIREMENTS")?.priority).toBe(10)
  })
})
