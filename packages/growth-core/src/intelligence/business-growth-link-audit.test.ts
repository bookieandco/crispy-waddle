import { describe, expect, it } from 'vitest'
import { auditObservedInternalLinks, type LinkPageObservation } from './business-growth-link-audit.js'

const website = 'https://pupsonstuff.example/'
const now = '2026-10-18T15:00:00Z'
const at = '2026-10-18T14:00:00Z'
function page(url: string, responseStatus = 200,
  outgoingLinks: LinkPageObservation['outgoingLinks'] = []): LinkPageObservation {
  return {
    url, responseStatus, outgoingLinks, inspectedAt: at,
    evidenceRef: 'crawl:' + url,
  }
}
describe('JH-PERSONAL-SEO.01 observed internal link diagnostics', () => {
  it('flags proven observed HTTP issues, redirects and noindex without authorizing fixes', () => {
    const target = page(website + 'product')
    target.noindex = true
    const report = auditObservedInternalLinks({
      website, observedAt: now,
      observations: [
        page(website, 200, [
          { href: '/missing', anchorText: 'Broken' },
          { href: '/moved', anchorText: 'Moved' },
          { href: '/product', anchorText: 'Product' },
          { href: '/unseen', anchorText: 'More' },
          { href: 'https://othersite.example/', anchorText: 'External' },
          { href: '#section' }, { href: 'mailto:hello@example.com' },
        ]),
        page(website + 'missing', 404),
        page(website + 'moved', 301),
        target,
      ],
    })
    expect(report.findings.map(x => x.issue)).toEqual(expect.arrayContaining([
      'LINK_TO_OBSERVED_HTTP_ERROR', 'LINK_TO_OBSERVED_REDIRECT',
      'LINK_TO_OBSERVED_NOINDEX', 'UNOBSERVED_INTERNAL_TARGET',
    ]))
    const broken = report.findings.find(x => x.issue === 'LINK_TO_OBSERVED_HTTP_ERROR')
    expect(broken?.severity).toBe('high')
    expect(broken?.evidenceRefs).toHaveLength(2)
    expect(report.externalLinksNotInspected).toBe(1)
    expect(report.internalLinks).toBe(4)
    expect(report.coverage).toBe('OBSERVED_PAGES_ONLY')
    expect(report.liveCrawlPerformed).toBe(false)
    expect(report.claimsCompleteSiteCoverage).toBe(false)
    expect(report.externalActionAuthorized).toBe(false)
    expect(report.findings.every(x => !x.eligibleForAutomaticRepair)).toBe(true)
  })
  it('treats unobserved targets as unknown, not fabricated broken links', () => {
    const report = auditObservedInternalLinks({
      website, observedAt: now,
      observations: [page(website, 200, [{href: '/never-crawled', anchorText: ''}])],
    })
    expect(report.findings.some(x => x.issue === 'LINK_TO_OBSERVED_HTTP_ERROR')).toBe(false)
    expect(report.findings.some(x => x.issue === 'UNOBSERVED_INTERNAL_TARGET')).toBe(true)
    expect(report.findings.some(x => x.issue === 'EMPTY_INTERNAL_ANCHOR')).toBe(true)
  })
  it('does not describe an observed unlinked page as a globally orphaned page', () => {
    const report = auditObservedInternalLinks({
      website, observedAt: now,
      observations: [page(website), page(website + 'unlinked')],
    })
    expect(report.findings).toEqual([expect.objectContaining({
      issue: 'NO_OBSERVED_INBOUND_LINKS', severity: 'review',
      sourceUrl: website + 'unlinked',
    })])
    expect(report.claimsCompleteSiteCoverage).toBe(false)
  })
  it('rejects cross-site, duplicate, stale, future and unsupported-link evidence', () => {
    expect(() => auditObservedInternalLinks({website, observedAt:now,
      observations:[page('https://attacker.example/')]})).toThrow('CROSS_SITE_OBSERVATION')
    expect(() => auditObservedInternalLinks({website, observedAt:now,
      observations:[page(website), page(website)]})).toThrow('DUPLICATE_PAGE')
    expect(() => auditObservedInternalLinks({website, observedAt:now,
      observations:[{...page(website), inspectedAt:'2026-01-01T00:00:00Z'}]
    })).toThrow('STALE_OR_FUTURE_OBSERVATION')
    expect(() => auditObservedInternalLinks({website, observedAt:now,
      observations:[{...page(website), inspectedAt:'2027-01-01T00:00:00Z'}]
    })).toThrow('STALE_OR_FUTURE_OBSERVATION')
    expect(() => auditObservedInternalLinks({website, observedAt:now,
      observations:[page(website, 200, [{href:'javascript:alert(1)'}])]
    })).toThrow('URL_INVALID')
  })
  it('normalizes fragments and duplicated links and enforces bounded input', () => {
    const result = auditObservedInternalLinks({website, observedAt: now,
      observations: [page(website, 200,
        [{href:'/ok#one'}, {href:'/ok#two'}, {href:'/ok'}]), page(website+'ok')],
    })
    expect(result.internalLinks).toBe(1)
    expect(result.findings).toEqual([])
    expect(() => auditObservedInternalLinks({website, observedAt:now,
      observations:[page(website,200,Array(101).fill({href:'/x'}))]
    })).toThrow('LINK_LIMIT')
  })
})
