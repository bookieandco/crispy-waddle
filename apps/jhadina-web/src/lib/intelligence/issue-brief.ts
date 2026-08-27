import type { TemporalTrend } from "./temporal"
import type { EvidenceQuality } from "./intervention-evaluation"
import type { OutcomeStatus } from "./outcome-tracker"

export type IssueEvidence = {
  id: string
  sourceId: string
  kind: "poll" | "social" | "government" | "news" | "policy" | "research"
  title: string
  url?: string
  confidence: number
  capturedAt: string
}

export type IssueOption = {
  interventionId: string
  name: string
  overallScore: number
  evidenceQuality: EvidenceQuality
  estimatedCost?: number
  implementationComplexity: "low" | "medium" | "high" | "unknown"
  evidenceIds: string[]
}

export type IssueOutcome = {
  targetId: string
  metric: string
  status: OutcomeStatus
  baseline: number
  current: number | null
  target: number
  progress: number | null
}

export type CampaignIssueBrief = {
  issueId: string
  issue: string
  generatedAt: string
  trend: TemporalTrend
  concernScore: number | null
  conditionSummary: string
  solutionGap: "unaddressed" | "partially_addressed" | "addressed" | "insufficient_evidence"
  options: IssueOption[]
  outcomes: IssueOutcome[]
  evidence: IssueEvidence[]
  caveats: string[]
  humanDecisionRequired: boolean
}

export function buildCampaignIssueBrief(input: CampaignIssueBrief): CampaignIssueBrief {
  return {
    ...input,
    options: [...input.options].sort((a, b) => b.overallScore - a.overallScore),
    evidence: [...input.evidence].sort((a, b) => b.confidence - a.confidence),
    caveats: [...new Set(input.caveats)],
    humanDecisionRequired: true,
  }
}
