export interface SamContractNotice {
  noticeId: string
  title: string
  solicitationNumber?: string
  agency?: string
  naicsCode?: string
  setAside?: string
  postedDate?: string
  responseDeadline?: string
  awardCeiling?: number
  placeOfPerformance?: string
  url: string
  description?: string
}

export interface GovernmentOpportunityProfile {
  noticeId: string
  title: string
  source: "sam_gov"
  sourceUrl: string
  agency?: string
  naicsCode?: string
  setAside?: string
  deadline?: string
  estimatedRevenue?: number
  evidence: string[]
}

/** Converts a public SAM.gov notice into Jhadina's source-neutral opportunity shape. */
export function normalizeSamNotice(notice: SamContractNotice): GovernmentOpportunityProfile {
  return {
    noticeId: notice.noticeId,
    title: notice.title,
    source: "sam_gov",
    sourceUrl: notice.url,
    agency: notice.agency,
    naicsCode: notice.naicsCode,
    setAside: notice.setAside,
    deadline: notice.responseDeadline,
    estimatedRevenue: notice.awardCeiling,
    evidence: [
      `SAM.gov notice ${notice.noticeId}`,
      notice.solicitationNumber ? `Solicitation ${notice.solicitationNumber}` : "",
      notice.naicsCode ? `NAICS ${notice.naicsCode}` : "",
      notice.setAside ? `Set-aside: ${notice.setAside}` : "",
    ].filter(Boolean),
  }
}

/** Uses only authorized/public API data; it does not scrape SAM.gov or use a user's SAM login for automation. */
export interface GovernmentOpportunitySource {
  readonly name: "sam_gov"
  search(input: { keywords?: string; naicsCode?: string; limit?: number }): Promise<SamContractNotice[]>
}
