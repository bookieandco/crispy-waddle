import type { SitePageObservation } from './business-growth-search-content.js'

/**
 * Personal Growth / SEO: deterministic observed-page link intelligence.
 * Works ONLY on explicitly supplied page evidence; it does not crawl or
 * fetch websites. The caller must verify site ownership and provenance.
 * Browser assertions of "verified" are NOT trusted credentials.
 */
export interface ObservedLink {
  href: string
  anchorText?: string
}
export interface LinkPageObservation extends SitePageObservation {
  outgoingLinks: ObservedLink[]
}
export type LinkIssue =
  | 'LINK_TO_OBSERVED_HTTP_ERROR'
  | 'LINK_TO_OBSERVED_REDIRECT'
  | 'LINK_TO_OBSERVED_NOINDEX'
  | 'UNOBSERVED_INTERNAL_TARGET'
  | 'EMPTY_INTERNAL_ANCHOR'
  | 'NO_OBSERVED_INBOUND_LINKS'

export interface ObservedLinkFinding {
  id: string
  issue: LinkIssue
  sourceUrl: string
  targetUrl?: string
  severity: 'high' | 'medium' | 'review'
  evidenceRefs: string[]
  /** Review only. Does not assert a broken link unless HTTP evidence exists. */
  eligibleForAutomaticRepair: false
}
export interface ObservedLinkAudit {
  website: string
  observedPages: number
  internalLinks: number
  externalLinksNotInspected: number
  findings: ObservedLinkFinding[]
  coverage: 'OBSERVED_PAGES_ONLY'
  liveCrawlPerformed: false
  verifiedProviderEvidence: false
  claimsCompleteSiteCoverage: false
  publishingAuthorized: false
  externalActionAuthorized: false
}

const fail = (tag: string): never => { throw new Error('GROWTH_LINK_AUDIT_' + tag) }
function urlOf(value: string, base?: string): URL {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) fail('URL_INVALID')
  let url: URL
  try { url = new URL(value, base) } catch { return fail('URL_INVALID') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('URL_INVALID')
  url.hash = ''
  url.searchParams.sort()
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/[/]+$/, '')
  return url
}
function originOf(url: URL): string {
  return url.protocol + '//' + url.host
}
function refsOk(page: LinkPageObservation, now: number): void {
  if (typeof page.evidenceRef !== 'string' || !page.evidenceRef.trim() || page.evidenceRef.length > 256)
    fail('EVIDENCE_REQUIRED')
  const at = Date.parse(page.inspectedAt)
  if (!Number.isFinite(at) || at > now || at < now - 31 * 86400000) fail('STALE_OR_FUTURE_OBSERVATION')
  if (!Number.isInteger(page.responseStatus) || page.responseStatus < 100 || page.responseStatus > 599)
    fail('HTTP_STATUS_INVALID')
  if (!Array.isArray(page.outgoingLinks) || page.outgoingLinks.length > 100) fail('LINK_LIMIT')
}
/**
 * Distinguishes observed broken internal links from targets that simply were
 * not included in the evidence set. "No inbound links" is a review lead, not
 * proof that a page is orphaned across the whole site.
 */
export function auditObservedInternalLinks(input: {
  website: string
  observations: LinkPageObservation[]
  observedAt: string
  pageLimit?: number
}): ObservedLinkAudit {
  const site = urlOf(input.website)
  if (site.protocol !== 'https:') fail('OWNED_HTTPS_SITE_REQUIRED')
  const now = Date.parse(input.observedAt)
  if (!Number.isFinite(now)) fail('AUDIT_TIME_INVALID')
  const limit = input.pageLimit ?? 150
  if (!Number.isInteger(limit) || limit < 1 || limit > 300 ||
      !Array.isArray(input.observations) || input.observations.length > limit) fail('PAGE_LIMIT')
  const pages = new Map<string, LinkPageObservation>()
  for (const page of input.observations) {
    const url = urlOf(page.url)
    if (originOf(url) !== originOf(site)) fail('CROSS_SITE_OBSERVATION')
    refsOk(page, now)
    if (pages.has(url.href)) fail('DUPLICATE_PAGE')
    pages.set(url.href, page)
  }
  const findings: ObservedLinkFinding[] = []
  const inbound = new Set<string>()
  let internalLinks = 0
  let externalLinksNotInspected = 0
  const push = (issue: LinkIssue, severity: ObservedLinkFinding['severity'],
    sourceUrl: string, evidenceRefs: string[], targetUrl?: string) => {
    findings.push({
      id: 'link:' + issue + ':' + sourceUrl + ':' + (targetUrl ?? ''),
      issue, severity, sourceUrl, targetUrl,
      evidenceRefs: [...new Set(evidenceRefs)].sort(),
      eligibleForAutomaticRepair: false,
    })
  }
  for (const [sourceUrl, page] of pages) {
    const dedup = new Set<string>()
    for (const link of page.outgoingLinks) {
      if (!link || typeof link.href !== 'string') fail('LINK_INVALID')
      // Mail, phone and document fragment links are not HTTP crawl targets.
      if (/^(mailto:|tel:|sms:|#)/i.test(link.href.trim())) continue
      const target = urlOf(link.href, sourceUrl)
      if (originOf(target) !== originOf(site)) {
        externalLinksNotInspected++
        continue
      }
      if (dedup.has(target.href)) continue
      dedup.add(target.href)
      internalLinks++
      const observed = pages.get(target.href)
      if (observed) {
        if (target.href !== sourceUrl) inbound.add(target.href)
        if (observed.responseStatus >= 400) {
          push('LINK_TO_OBSERVED_HTTP_ERROR', 'high', sourceUrl,
            [page.evidenceRef, observed.evidenceRef], target.href)
        } else if (observed.responseStatus >= 300 && observed.responseStatus < 400) {
          push('LINK_TO_OBSERVED_REDIRECT', 'medium', sourceUrl,
            [page.evidenceRef, observed.evidenceRef], target.href)
        } else if (observed.noindex) {
          push('LINK_TO_OBSERVED_NOINDEX', 'review', sourceUrl,
            [page.evidenceRef, observed.evidenceRef], target.href)
        }
      } else {
        push('UNOBSERVED_INTERNAL_TARGET', 'review', sourceUrl,
          [page.evidenceRef], target.href)
      }
      if (link.anchorText !== undefined && !link.anchorText.trim()) {
        push('EMPTY_INTERNAL_ANCHOR', 'review', sourceUrl,
          [page.evidenceRef], target.href)
      }
    }
  }
  for (const [targetUrl, page] of pages) {
    if (targetUrl !== site.href && !inbound.has(targetUrl) && page.responseStatus < 400) {
      push('NO_OBSERVED_INBOUND_LINKS', 'review', targetUrl, [page.evidenceRef])
    }
  }
  findings.sort((a, b) => {
    const priority = { high: 0, medium: 1, review: 2 }
    return priority[a.severity] - priority[b.severity] || a.id.localeCompare(b.id)
  })
  return {
    website: site.href, observedPages: pages.size, internalLinks,
    externalLinksNotInspected, findings,
    coverage: 'OBSERVED_PAGES_ONLY', liveCrawlPerformed: false,
    verifiedProviderEvidence: false, claimsCompleteSiteCoverage: false,
    publishingAuthorized: false, externalActionAuthorized: false,
  }
}
