export type EvidenceKind =
  | "poll"
  | "public_opinion"
  | "official_statistic"
  | "government_report"
  | "local_news"
  | "public_feedback"
  | "field_note"
  | "election_result"

export type EvidenceRecord = {
  id: string
  kind: EvidenceKind
  source: string
  sourceUrl: string
  publishedAt: string
  geography?: string
  issue: string
  claim: string
  value?: number
  unit?: string
  methodology?: string
  confidence?: "low" | "medium" | "high"
}

export type IssueAssessment = {
  issue: string
  evidenceCount: number
  confidence: "low" | "medium" | "high"
  signal: "rising" | "persistent" | "improving" | "mixed" | "insufficient_data"
  problemStatement: string
  improvementAreas: string[]
  evidenceIds: string[]
  humanReviewRequired: true
}

/**
 * CampaignOS converts public evidence into issue-improvement work.
 * It does not target individuals, generate persuasion instructions, or
 * automatically change campaign strategy. Human review remains mandatory.
 */
export function assessIssue(
  evidence: EvidenceRecord[],
  issue: string,
): IssueAssessment {
  const relevant = evidence.filter((item) => item.issue.toLowerCase() === issue.toLowerCase())

  if (relevant.length === 0) {
    return {
      issue,
      evidenceCount: 0,
      confidence: "low",
      signal: "insufficient_data",
      problemStatement: `Insufficient evidence to assess ${issue}.`,
      improvementAreas: [],
      evidenceIds: [],
      humanReviewRequired: true,
    }
  }

  const highConfidence = relevant.filter((item) => item.confidence === "high").length
  const confidence = relevant.length >= 8 || highConfidence >= 3
    ? "high"
    : relevant.length >= 4 || highConfidence >= 1
      ? "medium"
      : "low"

  const sources = new Set(relevant.map((item) => item.source)).size
  const signal = sources >= 3 ? "persistent" : "mixed"

  return {
    issue,
    evidenceCount: relevant.length,
    confidence,
    signal,
    problemStatement: `Evidence indicates a public problem around ${issue}; the next step is to identify measurable causes, interventions, owners, and outcomes.`,
    improvementAreas: [
      "Define the measurable outcome residents should experience",
      "Identify policy and implementation levers",
      "Find existing programs and quantify their gaps",
      "Design a practical intervention with cost, authority, and timeline",
      "Create a public outcome metric and after-action review",
    ],
    evidenceIds: relevant.map((item) => item.id),
    humanReviewRequired: true,
  }
}

export type ImprovementPlan = {
  issue: string
  objective: string
  baseline: string
  intervention: string
  owner: string
  deadline: string
  metric: string
  evidenceIds: string[]
  status: "draft" | "approved" | "active" | "completed" | "blocked"
}

export function createImprovementPlan(input: Omit<ImprovementPlan, "status">): ImprovementPlan {
  return { ...input, status: "draft" }
}
