export type ResearchBranchKind =
  | "AGENCY"
  | "REQUIREMENTS"
  | "INCUMBENT"
  | "COMPETITORS"
  | "PARTNERS"
  | "ECONOMICS"
  | "NEXT_ACTION"

export type ResearchBranchStatus = "PENDING" | "READY" | "COMPLETE" | "BLOCKED"

export interface ResearchBranch {
  id: string
  kind: ResearchBranchKind
  question: string
  status: ResearchBranchStatus
  findings: string[]
}

export interface MoneyResearchCase {
  id: string
  opportunityId: string
  source: "sam.gov"
  title: string
  createdAt: string
  branches: ResearchBranch[]
}

function branch(id: string, kind: ResearchBranchKind, question: string): ResearchBranch {
  return { id, kind, question, status: "PENDING", findings: [] }
}

export function createMoneyResearchCase(input: {
  opportunityId: string
  title: string
  now?: Date
}): MoneyResearchCase {
  const prefix = input.opportunityId || "opportunity"
  return {
    id: `research-${prefix}`,
    opportunityId: input.opportunityId,
    source: "sam.gov",
    title: input.title,
    createdAt: (input.now || new Date()).toISOString(),
    branches: [
      branch(`${prefix}-agency`, "AGENCY", "Who is buying, what is their mission, and who is the contracting point of contact?"),
      branch(`${prefix}-requirements`, "REQUIREMENTS", "What capabilities, certifications, deliverables, place of performance, and deadlines are required?"),
      branch(`${prefix}-incumbent`, "INCUMBENT", "Is there an incumbent contract or known incumbent provider?"),
      branch(`${prefix}-competitors`, "COMPETITORS", "Which vendors appear capable of competing and what evidence supports that?"),
      branch(`${prefix}-partners`, "PARTNERS", "Which missing capabilities could be filled by a credible partner or subcontractor?"),
      branch(`${prefix}-economics`, "ECONOMICS", "What revenue, cost, margin, and pursuit-effort assumptions should drive the decision?"),
      branch(`${prefix}-next-action`, "NEXT_ACTION", "What is the smallest high-value next action Jhadina should recommend?"),
    ],
  }
}
