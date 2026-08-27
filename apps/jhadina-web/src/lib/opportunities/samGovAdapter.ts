export type SamNoticeType =
  | "solicitation"
  | "sources_sought"
  | "request_for_information"
  | "special_notice"
  | "unknown"

export type SamGovOpportunityRecord = {
  noticeId: string
  title: string
  solicitationNumber?: string
  noticeType?: string
  postedDate?: string
  responseDeadline?: string
  agency?: string
  subTier?: string
  office?: string
  naicsCode?: string
  setAside?: string
  estimatedValue?: number
  description?: string
  url: string
}

export type NormalizedSamOpportunity = {
  externalRecordId: string
  sourceKey: "sam.gov"
  sourceName: "SAM.gov Contract Opportunities"
  sourceUrl: string
  title: string
  noticeType: SamNoticeType
  solicitationNumber?: string
  postedDate?: string
  responseDeadline?: string
  agency?: string
  office?: string
  naicsCode?: string
  setAside?: string
  estimatedValue?: number
  description?: string
  // Discovery is not eligibility, bid authorization, or award prediction.
  requiresHumanReview: true
  requiresUserApproval: true
}

function normalizeNoticeType(value?: string): SamNoticeType {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (!normalized) return "unknown"
  if (normalized.includes("sources_sought")) return "sources_sought"
  if (normalized.includes("request_for_information") || normalized === "rfi") return "request_for_information"
  if (normalized.includes("solicitation") || normalized.includes("combined_synopsis")) return "solicitation"
  if (normalized.includes("special_notice")) return "special_notice"
  return "unknown"
}

function finiteNonNegative(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative number.`)
  return value
}

/**
 * Normalize a SAM.gov Contract Opportunities record into Jhadina's discovery
 * model. This function intentionally does not call SAM.gov and does not make
 * bid/eligibility/award decisions.
 */
export function normalizeSamGovOpportunity(record: SamGovOpportunityRecord): NormalizedSamOpportunity {
  if (!record.noticeId) throw new Error("noticeId is required.")
  if (!record.title) throw new Error("title is required.")
  if (!record.url) throw new Error("url is required.")

  return {
    externalRecordId: record.noticeId,
    sourceKey: "sam.gov",
    sourceName: "SAM.gov Contract Opportunities",
    sourceUrl: record.url,
    title: record.title.trim(),
    noticeType: normalizeNoticeType(record.noticeType),
    solicitationNumber: record.solicitationNumber,
    postedDate: record.postedDate,
    responseDeadline: record.responseDeadline,
    agency: record.agency,
    office: record.office,
    naicsCode: record.naicsCode,
    setAside: record.setAside,
    estimatedValue: finiteNonNegative(record.estimatedValue, "estimatedValue"),
    description: record.description,
    requiresHumanReview: true,
    requiresUserApproval: true,
  }
}
