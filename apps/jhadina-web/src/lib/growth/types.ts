export type GrowthPlatform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "YOUTUBE" | "YOUTUBE_SHORTS" | "X" | "LINKEDIN"

export type GrowthBrand = "JHADINA" | "JHADINATV" | "JHADINA_MUSIC" | "OVERAGEOS" | "PUPSONSTUFF" | "ATWOOD_BOOKIE"

export type ContentKind = "POST" | "REEL" | "SHORT" | "VIDEO" | "CAROUSEL" | "THREAD" | "COMMENT"

export type DraftStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SCHEDULED" | "PUBLISHED"

export interface GrowthDraft {
  id: string
  userId: string
  brand: GrowthBrand
  platforms: GrowthPlatform[]
  kind: ContentKind
  title?: string
  body: string
  mediaIds: string[]
  sourceAssetId?: string
  status: DraftStatus
  rationale: string
  suggestedPublishAt?: string
  seo?: { keywords: string[]; title?: string; description?: string; hashtags: string[] }
  createdAt: string
  approvedAt?: string
  scheduledAt?: string
  publishedAt?: string
  parentDraftId?: string
  redraftInstruction?: string
}

export interface GrowthIdea {
  id: string
  userId: string
  brand: GrowthBrand
  title: string
  premise: string
  source: "JHADINA" | "DIRECTOROS" | "TREND_RESEARCH" | "ANALYTICS" | "COMPETITOR"
  platforms: GrowthPlatform[]
  score: number
  createdAt: string
}
