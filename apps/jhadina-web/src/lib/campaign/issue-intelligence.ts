export type IssueEvidence = {
  id: string
  issue: string
  sourceType: "poll" | "government_data" | "social" | "news" | "policy"
  sourceId: string
  value?: number
  unit?: string
  direction?: "up" | "down" | "stable"
  confidence: number
  capturedAt: string
  sourceUrl: string
}

export type IssueAssessment = {
  issue: string
  evidenceCount: number
  sourceTypes: string[]
  averageConfidence: number
  signals: {
    publicConcern: number | null
    observedCondition: number | null
    policyActivity: number | null
  }
  status: "corroborated" | "developing" | "insufficient_data"
  caveats: string[]
}

/**
 * Describes the gap between what people are discussing, measurable conditions,
 * and policy activity. It does not prescribe targeted persuasion tactics.
 */
export function assessIssue(issue: string, evidence: IssueEvidence[]): IssueAssessment {
  const relevant = evidence.filter((item) => item.issue.toLowerCase() === issue.toLowerCase())
  const sourceTypes = [...new Set(relevant.map((item) => item.sourceType))]
  const averageConfidence = relevant.length
    ? relevant.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.confidence)), 0) / relevant.length
    : 0

  const averageFor = (types: IssueEvidence["sourceType"][]) => {
    const values = relevant.filter((item) => types.includes(item.sourceType) && typeof item.value === "number")
    return values.length ? values.reduce((sum, item) => sum + (item.value ?? 0), 0) / values.length : null
  }

  const publicConcern = averageFor(["poll", "social"])
  const observedCondition = averageFor(["government_data"])
  const policyActivity = averageFor(["policy"])

  const caveats: string[] = []
  if (!relevant.length) caveats.push("No matching evidence was supplied.")
  if (!sourceTypes.includes("government_data")) caveats.push("No government-data observation is present.")
  if (!sourceTypes.includes("poll")) caveats.push("No polling observation is present.")
  if (relevant.filter((item) => item.sourceType === "social").length > 0) {
    caveats.push("Social signals indicate discussion, not population-wide opinion.")
  }

  return {
    issue,
    evidenceCount: relevant.length,
    sourceTypes,
    averageConfidence,
    signals: { publicConcern, observedCondition, policyActivity },
    status: relevant.length >= 3 && sourceTypes.length >= 2 && averageConfidence >= 0.6
      ? "corroborated"
      : relevant.length > 0
        ? "developing"
        : "insufficient_data",
    caveats,
  }
}
