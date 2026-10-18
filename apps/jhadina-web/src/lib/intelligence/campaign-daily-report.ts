import type { CampaignIssueBrief } from "./issue-brief"

export type CampaignDailyReport = {
  generatedAt: string
  headline: string
  changedToday: CampaignIssueBrief[]
  decisionsWaiting: CampaignIssueBrief[]
  watchlist: CampaignIssueBrief[]
  quiet: CampaignIssueBrief[]
}

/**
 * Deterministic report assembly. Ranking/synthesis inputs remain inspectable;
 * a language model may narrate this report but cannot change its evidence.
 */
export function buildCampaignDailyReport(
  briefs: CampaignIssueBrief[],
  now = new Date(),
): CampaignDailyReport {
  const ranked = [...briefs].sort((a, b) => {
    const trendWeight = (trend: CampaignIssueBrief["trend"]) =>
      trend === "accelerating" ? 4 : trend === "rising" ? 3 : trend === "new" ? 2 : trend === "stable" ? 1 : 0
    return trendWeight(b.trend) - trendWeight(a.trend)
  })

  const changedToday = ranked.filter((brief) =>
    ["accelerating", "rising", "new"].includes(brief.trend),
  )
  const decisionsWaiting = ranked.filter((brief) => brief.humanDecisionRequired)
  const watchlist = ranked.filter((brief) =>
    brief.trend === "stable" || brief.solutionGap === "insufficient_evidence",
  )
  const quiet = ranked.filter((brief) => !changedToday.includes(brief) && !watchlist.includes(brief))

  return {
    generatedAt: now.toISOString(),
    headline: briefs.length === 0
      ? "No campaign issue briefs available."
      : `${changedToday.length} issues changed materially; ${decisionsWaiting.length} require human review.`,
    changedToday,
    decisionsWaiting,
    watchlist,
    quiet,
  }
}
