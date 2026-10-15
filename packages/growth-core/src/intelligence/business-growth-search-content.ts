import type { GscSnapshot } from './business-growth-gsc.js'
import { createCoreAnswer, createSurfaceTranslation, type CoreAnswer, type SurfaceTranslation } from './search-everywhere.js'

/** BIZ-GROWTH.03-.06: strategy and drafts, reusing canonical Growth/Social authorities. */
export type SitePageObservation = {
  url: string
  responseStatus: number
  title?: string
  description?: string
  canonicalUrl?: string
  noindex?: boolean
  schemaTypes?: string[]
  productOfferId?: string
  evidenceRef: string
  inspectedAt: string
}
export type SiteFinding = {
  id: string
  url: string
  issue: 'HTTP_ERROR' | 'NOINDEX' | 'CANONICAL_MISMATCH'
    | 'TITLE_MISSING' | 'DESCRIPTION_MISSING' | 'PRODUCT_SCHEMA_MISSING'
  priority: 'critical' | 'high' | 'medium'
  observationRef: string
  externalActionAuthorized: false
}
export type SiteAudit = {
  findings: SiteFinding[]
  scannedPageCount: number
  incomplete: boolean
  claimsRankingImprovement: false
}

function requireText(value: string, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('BIZ_GROWTH_' + label + '_REQUIRED')
  return value.trim()
}
function normalizeUrl(value: string) {
  const u = new URL(value)
  if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw new Error('BIZ_GROWTH_URL_INVALID')
  u.hash = ''
  u.searchParams.sort()
  if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/,'')
  return u.toString()
}
function owned(page: string, website: string): boolean {
  const a = new URL(normalizeUrl(page)), b = new URL(normalizeUrl(website))
  return a.hostname === b.hostname && a.protocol === b.protocol
}

export function inspectOwnedWebsite(input: {
  website: string
  observations: SitePageObservation[]
  pageLimit?: number
}): SiteAudit {
  const website = normalizeUrl(input.website)
  const limit = input.pageLimit ?? 200
  if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) throw new Error('BIZ_GROWTH_AUDIT_LIMIT_INVALID')
  if (input.observations.length > limit) throw new Error('BIZ_GROWTH_AUDIT_LIMIT_EXCEEDED')
  const findings: SiteFinding[] = []
  const seen = new Set<string>()
  for (const page of input.observations) {
    const url = normalizeUrl(page.url)
    if (!owned(url, website)) throw new Error('BIZ_GROWTH_AUDIT_CROSS_SITE')
    if (seen.has(url)) throw new Error('BIZ_GROWTH_AUDIT_DUPLICATE_PAGE')
    seen.add(url)
    requireText(page.evidenceRef,'AUDIT_EVIDENCE')
    if (!Number.isFinite(Date.parse(page.inspectedAt))) throw new Error('BIZ_GROWTH_AUDIT_TIME_INVALID')
    if (!Number.isInteger(page.responseStatus) || page.responseStatus < 100 || page.responseStatus > 599) {
      throw new Error('BIZ_GROWTH_HTTP_STATUS_INVALID')
    }
    const add = (issue: SiteFinding['issue'], priority: SiteFinding['priority']) => {
      findings.push({ id: 'audit:' + url + ':' + issue, url,
        issue, priority, observationRef: page.evidenceRef, externalActionAuthorized: false })
    }
    if (page.responseStatus >= 400) { add('HTTP_ERROR','critical'); continue }
    if (page.noindex) add('NOINDEX','high')
    if (!page.title?.trim()) add('TITLE_MISSING','high')
    if (!page.description?.trim()) add('DESCRIPTION_MISSING','medium')
    if (page.canonicalUrl && normalizeUrl(page.canonicalUrl) !== url) {
      // Intentional canonicals also require review; do not fix automatically.
      add('CANONICAL_MISMATCH','medium')
    }
    if (page.productOfferId && !(page.schemaTypes ?? []).some(x => x.toLowerCase() === 'product')) {
      add('PRODUCT_SCHEMA_MISSING','high')
    }
  }
  return { findings, scannedPageCount: seen.size,
    incomplete: !seen.size || seen.size === limit,
    claimsRankingImprovement: false }
}

export type CompetitorObservation = {
  id: string
  url: string
  businessName: string
  overlap: 'direct' | 'adjacent' | 'unverified'
  evidenceRefs: string[]
  observedAt: string
}
export type BuyerQueryCandidate = {
  id: string
  phrase: string
  intent: 'transactional' | 'commercial' | 'informational'
  buyerProblem: string
  possibleOfferId?: string
  evidenceRefs: string[]
}
export type RankedGrowthAction = {
  queryId: string
  priority: number
  kind: 'REPAIR_EXISTING' | 'REFRESH_EXISTING' | 'CREATE_DRAFT' | 'RESEARCH_ONLY'
  targetUrl?: string
  reason: string
  evidenceRefs: string[]
  eligibleForAutomaticPublishing: false
}
export function rankBusinessSearchWork(input: {
  website: string
  gsc?: GscSnapshot
  candidates: BuyerQueryCandidate[]
  existingPages: string[]
  competitors: CompetitorObservation[]
}): { actions: RankedGrowthAction[]; competitorReview: CompetitorObservation[] } {
  const website = normalizeUrl(input.website)
  const pages = new Set(input.existingPages.map(page => {
    const normalized = normalizeUrl(page)
    if (!owned(normalized,website)) throw new Error('BIZ_GROWTH_EXISTING_PAGE_OUTSIDE_SITE')
    return normalized
  }))
  const competitors = input.competitors.map(row => {
    if (!row.id.trim() || !row.businessName.trim() || !row.evidenceRefs.length
      || !Number.isFinite(Date.parse(row.observedAt))) throw new Error('BIZ_GROWTH_COMPETITOR_EVIDENCE_MISSING')
    normalizeUrl(row.url)
    if (owned(row.url,website)) throw new Error('BIZ_GROWTH_COMPETITOR_IS_OWN_SITE')
    // These observations are leads for manual verification, not certified direct competitors.
    return { ...row, overlap: 'unverified' as const }
  })
  const actions = input.candidates.map((candidate): RankedGrowthAction => {
    const phrase = requireText(candidate.phrase,'QUERY')
    requireText(candidate.buyerProblem,'BUYER_PROBLEM')
    const refs = [...new Set(candidate.evidenceRefs.filter(Boolean))]
    const matched = input.gsc?.rows.find(row => row.query.toLowerCase() === phrase.toLowerCase()
      && owned(row.page, website))
    const matchingPage = matched?.page && pages.has(normalizeUrl(matched.page)) ? normalizeUrl(matched.page) : undefined
    const valuable = candidate.intent !== 'informational' && !!candidate.possibleOfferId
    let kind: RankedGrowthAction['kind']='RESEARCH_ONLY'
    let reason='Needs verified buyer-demand/offer evidence before page creation'
    if (matchingPage) {
      kind = matched && matched.clicks >= 25 ? 'REPAIR_EXISTING' : 'REFRESH_EXISTING'
      reason = 'Existing owned page observed in first-party search data: optimize before adding another URL'
    } else if (valuable && refs.length && input.gsc && input.gsc.rows.length > 0) {
      kind='CREATE_DRAFT'
      reason='High-intent offer candidate not observed among supplied existing pages; requires human review and original proof'
    } else if (candidate.intent==='informational') {
      reason='Informational query alone is not a reason to mass-produce content'
    }
    const priority = (candidate.intent==='transactional'?60:candidate.intent==='commercial'?45:10)
      + (matchingPage?25:0) + (refs.length?10:0) + (matched?5:0)
    return {
      queryId: candidate.id, kind, targetUrl: matchingPage,
      priority, reason, evidenceRefs: [...new Set([...refs, ...(matched?[matched.id]:[])])],
      eligibleForAutomaticPublishing: false,
    }
  })
  actions.sort((a,b)=>b.priority-a.priority||a.queryId.localeCompare(b.queryId))
  return { actions, competitorReview: competitors }
}

export type GrowthContentBrief = {
  id: string
  businessId: string
  offerId: string
  title: string
  intent: BuyerQueryCandidate['intent']
  buyerQuestion: string
  customerBenefit: string
  sourceRefs: string[]
  claimEvidenceRefs: string[]
  existingPageUrl?: string
  CTAUrl: string
  mediaRightsRefs: string[]
  state: 'draft_needs_owner_review'
  approvalReceiptId: null
  publishingAuthorized: false
  communityPostingAuthorized: false
  adSpendAuthorized: false
}
export function prepareGrowthContentBrief(input: Omit<GrowthContentBrief,
  'state' | 'approvalReceiptId' | 'publishingAuthorized' | 'communityPostingAuthorized' | 'adSpendAuthorized'>): GrowthContentBrief {
  requireText(input.id,'BRIEF_ID')
  requireText(input.businessId,'BUSINESS_ID')
  requireText(input.offerId,'OFFER_ID')
  requireText(input.buyerQuestion,'BUYER_QUESTION')
  requireText(input.title,'TITLE')
  requireText(input.customerBenefit,'CUSTOMER_BENEFIT')
  if (!input.sourceRefs.length || !input.claimEvidenceRefs.length || !input.mediaRightsRefs.length) {
    throw new Error('BIZ_GROWTH_BRIEF_PROVENANCE_REQUIRED')
  }
  if (!owned(input.CTAUrl,input.CTAUrl)) throw new Error('BIZ_GROWTH_BRIEF_CTA_INVALID')
  if (input.existingPageUrl && !owned(input.existingPageUrl,input.CTAUrl)) {
    throw new Error('BIZ_GROWTH_BRIEF_CROSS_BUSINESS_LINK')
  }
  return { ...input, state:'draft_needs_owner_review', approvalReceiptId:null,
    publishingAuthorized:false, communityPostingAuthorized:false, adSpendAuthorized:false }
}

export type ContentDistributionHandoff = {
  briefId: string
  businessId: string
  coreAnswer: CoreAnswer
  drafts: SurfaceTranslation[]
  reviewState: 'BLOCKED_PENDING_CANONICAL_APPROVAL'
  directPostingAuthorized: false
  providerAccountAuthority: 'NOT_GRANTED'
}
/**
 * Hands drafts to *existing* Social/Director surfaces. This is NOT another
 * scheduler, CMS client, Reddit bot, or publication approval authority.
 */
export function prepareGrowthDistribution(input: {
  brief: GrowthContentBrief
  brandId: string
  anchorAssetId: string
  humanApprovedSourceAnswer: string
  claims: string[]
  createdAt: string
  surfaces: Array<'social:youtube' | 'social:instagram' | 'social:facebook' | 'social:x' | 'community:reddit'>
}): ContentDistributionHandoff {
  requireText(input.anchorAssetId,'ANCHOR_ASSET')
  if (input.surfaces.length > 5 || !input.surfaces.length) throw new Error('BIZ_GROWTH_SURFACES_INVALID')
  if (!input.humanApprovedSourceAnswer.trim() || !input.claims.length) throw new Error('BIZ_GROWTH_SOURCE_ANSWER_REQUIRED')
  const coreAnswer = createCoreAnswer({
    id: input.anchorAssetId, brandId: input.brandId,
    question: input.brief.buyerQuestion,
    answer: input.humanApprovedSourceAnswer, claims: input.claims,
    evidenceRefs: input.brief.claimEvidenceRefs, createdAt: input.createdAt,
  })
  const drafts = [...new Set(input.surfaces)].map((surface) => createSurfaceTranslation(coreAnswer,{
    id: input.brief.id + ':' + surface,
    surfaceId: surface,
    format: surface === 'social:youtube' ? 'video' : surface === 'community:reddit' ? 'community_post' : 'social_post',
    title: input.brief.title,
    message: input.humanApprovedSourceAnswer, // source text, NOT platform-published copy
    sourceAssetId: input.anchorAssetId,
    evidenceRefs: [...new Set([...input.brief.sourceRefs,...input.brief.claimEvidenceRefs])],
  }))
  return {
    briefId: input.brief.id, businessId: input.brief.businessId, coreAnswer, drafts,
    reviewState:'BLOCKED_PENDING_CANONICAL_APPROVAL',
    directPostingAuthorized:false, providerAccountAuthority:'NOT_GRANTED',
  }
}
