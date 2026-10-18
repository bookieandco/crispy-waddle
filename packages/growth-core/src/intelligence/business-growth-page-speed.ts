/**
 * Personal Jhadina SEO: read-only PageSpeed Insights v5 adapter.
 * No owned-site connection or scheduling authority is created here.
 * The trusted server caller must establish business -> exact site ownership.
 * Google Lighthouse lab scores are NOT Search Console rankings or real-user CWV.
 * https://developers.google.com/speed/docs/insights/v5/get-started
 */
export interface PageSpeedSnapshot {
  pageUrl: string
  strategy: 'mobile' | 'desktop'
  checkedAt: string
  scores: {
    performance: number | null
    seo: number | null
    accessibility: number | null
    bestPractices: number | null
  }
  findings: Array<{ id: string; title: string; score: number | null; displayValue?: string }>
  source: 'GOOGLE_PAGESPEED_INSIGHTS_V5'
  measurementType: 'LAB_ONLY'
  fieldCoreWebVitalsVerified: false
  rankingImprovementClaimed: false
  externalActionAuthorized: false
}
type Fetcher = (url: string, init: RequestInit) => Promise<Response>
function reject(code: string): never { throw new Error('GROWTH_PSI_' + code) }
function exactOwnedHttps(input: string): URL {
  let url: URL
  try { url = new URL(input) } catch { return reject('URL_INVALID') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    url.hostname.length > 253 || !/^[a-z0-9.-]+$/i.test(url.hostname) ||
    url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    url.hostname.endsWith('.local') || url.hostname.endsWith('.internal') ||
    /^[0-9]+(?:[.][0-9]+){3}$/.test(url.hostname) || !url.hostname.includes('.')) {
    reject('PUBLIC_HTTPS_SITE_REQUIRED')
  }
  url.hash = ''
  return url
}
const obj = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
function fraction(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
    reject('SCORE_INVALID')
  return Math.round(value * 100)
}
/** Invoke only from an authenticated, owner-verified server-side site registry. */
export async function fetchOwnedPageSpeed(input: {
  businessWebsite: string
  pageUrl: string
  strategy: 'mobile' | 'desktop'
  checkedAt: string
  serverApiKey?: string
  fetchClient?: Fetcher
}): Promise<PageSpeedSnapshot> {
  const business = exactOwnedHttps(input.businessWebsite)
  const page = exactOwnedHttps(input.pageUrl)
  if (business.origin !== page.origin ||
    (business.pathname !== '/' && !page.pathname.startsWith(business.pathname.replace(/[/]+$/, '') + '/')))
    reject('CROSS_BUSINESS_PAGE')
  if (input.strategy !== 'mobile' && input.strategy !== 'desktop') reject('STRATEGY_INVALID')
  const now = Date.parse(input.checkedAt)
  if (!Number.isFinite(now)) reject('TIME_INVALID')
  const query = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  query.searchParams.set('url', page.toString())
  query.searchParams.set('strategy', input.strategy)
  for (const category of ['performance','seo','accessibility','best-practices'])
    query.searchParams.append('category', category)
  if (input.serverApiKey) query.searchParams.set('key', input.serverApiKey)
  const response = await (input.fetchClient ?? fetch)(query.toString(), {
    method: 'GET', redirect: 'error', cache: 'no-store',
  })
  if (!response.ok) reject('PROVIDER_HTTP_' + response.status)
  const json = await response.json() as unknown
  if (!obj(json) || typeof json.id !== 'string' || !obj(json.lighthouseResult))
    reject('RESPONSE_MALFORMED')
  // If Google followed an on-site redirect to a different domain, never
  // treat the data as evidence about the owner's registered page.
  const resolved = exactOwnedHttps(json.id)
  if (resolved.origin !== business.origin) reject('PROVIDER_REDIRECTED_OFFSITE')
  const lh = json.lighthouseResult
  if (!obj(lh.categories) || !obj(lh.audits)) reject('LIGHTHOUSE_MALFORMED')
  const categories = lh.categories
  const score = (category: string) => {
    const row = categories[category]
    return obj(row) ? fraction(row.score) : null
  }
  const findings = Object.entries(lh.audits).flatMap(([id, value]) => {
    if (!obj(value) || typeof value.title !== 'string' || value.title.length > 300)
      return []
    const result = fraction(value.score)
    // Missing/not-applicable audits are not failures; no fake 0 scores.
    if (result === null || result >= 90) return []
    return [{id, title: value.title, score: result,
      ...(typeof value.displayValue === 'string'
        ? {displayValue: value.displayValue.slice(0, 150)} : {})}]
  }).sort((a,b)=>(a.score ?? 100)-(b.score ?? 100)||a.id.localeCompare(b.id)).slice(0,20)
  return {
    pageUrl: page.toString(), strategy: input.strategy, checkedAt: input.checkedAt,
    scores: {
      performance:score('performance'), seo:score('seo'),
      accessibility:score('accessibility'), bestPractices:score('best-practices'),
    }, findings, source:'GOOGLE_PAGESPEED_INSIGHTS_V5',
    measurementType:'LAB_ONLY',fieldCoreWebVitalsVerified:false,
    rankingImprovementClaimed:false,externalActionAuthorized:false,
  }
}
