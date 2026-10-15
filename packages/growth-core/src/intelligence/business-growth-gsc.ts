/**
 * BIZ-GROWTH.02: read-only Google Search Console port.
 *
 * Caller must obtain a Google OAuth token with webmasters.readonly from an
 * OWNER-AUTHORIZED, SERVER-SIDE connection. This module never stores tokens,
 * upgrades browser input to provider truth, or grants an action capability.
 * Official reference: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */
export type GscSite = { siteUrl: string; permissionLevel: string }
export type GscQueryRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
export type GscObservation = {
  id: string
  property: string
  query: string
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  period: { startDate: string; endDate: string }
  retrievedAt: string
  source: 'GOOGLE_SEARCH_CONSOLE_API'
  evidenceStatus: 'PROVIDER_OBSERVED_NOT_CONVERSION'
  externalActionAuthorized: false
}
export type GscSnapshot = {
  property: string
  retrievedAt: string
  dateRange: { startDate: string; endDate: string }
  rows: GscObservation[]
  truncatedOrIncomplete: boolean
  revenueVerified: false
  externalActionAuthorized: false
}
export type GscHttpClient = (url: string, init: RequestInit) => Promise<Response>

const HOST = 'https://www.googleapis.com'
const DATE = /^\d{4}-\d\d-\d\d$/
const PERMISSIONS = new Set(['siteOwner','siteFullUser','siteRestrictedUser'])
function requireDate(s: string) {
  if (!DATE.test(s) || new Date(s + 'T00:00:00Z').toISOString().slice(0,10) !== s) {
    throw new Error('GSC_DATE_INVALID')
  }
}
function hostFor(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad')
    if (u.username || u.password) throw new Error('bad')
    return u.hostname.toLowerCase()
  } catch { throw new Error('GSC_SITE_URL_INVALID') }
}
function belongsToProperty(property: string, page: string): boolean {
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice('sc-domain:'.length).toLowerCase()
    const host = hostFor(page)
    return !!domain && (host === domain || host.endsWith('.' + domain))
  }
  const p = new URL(property)
  const u = new URL(page)
  return (p.protocol === u.protocol && p.host === u.host
    && u.pathname.startsWith(p.pathname.endsWith('/') ? p.pathname : p.pathname + '/'))
}
function validateProperty(property: string, ownedHost: string): void {
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice(10).toLowerCase()
    if (!domain || !/^[a-z0-9.-]+$/.test(domain)
      || !(ownedHost === domain || ownedHost.endsWith('.' + domain))) {
      throw new Error('GSC_PROPERTY_NOT_OWNED_BY_BUSINESS')
    }
    return
  }
  if (hostFor(property) !== ownedHost) throw new Error('GSC_PROPERTY_NOT_OWNED_BY_BUSINESS')
}
async function json(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error('GSC_PROVIDER_HTTP_' + response.status)
  return response.json() as Promise<unknown>
}
const record = (x: unknown): x is Record<string,unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const metric = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('GSC_METRIC_INVALID')
  return v
}

/** This port ONLY contacts Google's fixed API host and only GETs / POSTs read-only analytics. */
export async function fetchReadOnlyGscSnapshot(input: {
  businessWebsite: string
  property: string
  startDate: string
  endDate: string
  retrievedAt: string
  serverAccessToken: string
  rowLimit?: number
  fetchClient?: GscHttpClient
}): Promise<GscSnapshot> {
  const ownedHost = hostFor(input.businessWebsite)
  validateProperty(input.property, ownedHost)
  requireDate(input.startDate); requireDate(input.endDate)
  if (input.startDate > input.endDate) throw new Error('GSC_WINDOW_INVALID')
  const retrievedMs = Date.parse(input.retrievedAt)
  if (!Number.isFinite(retrievedMs) || input.endDate > input.retrievedAt.slice(0,10)) {
    throw new Error('GSC_FUTURE_OR_INVALID_RETRIEVAL')
  }
  const limit = input.rowLimit ?? 1000
  if (!Number.isInteger(limit) || limit < 1 || limit > 2500) throw new Error('GSC_ROW_LIMIT_INVALID')
  if (!input.serverAccessToken?.trim()) throw new Error('GSC_SERVER_OAUTH_REQUIRED')
  const fetcher = input.fetchClient ?? fetch
  const auth = { authorization: 'Bearer ' + input.serverAccessToken }
  // Verify Google actually granted this account access. Site presence is not
  // independent proof that the application's business owner controls a domain;
  // that mapping must be separately established by Jhadina.
  const sites = await json(await fetcher(HOST + '/webmasters/v3/sites', {
    method: 'GET', headers: auth, redirect: 'error',
  }))
  if (!record(sites) || !Array.isArray(sites.siteEntry)) throw new Error('GSC_SITE_LIST_MALFORMED')
  const member = (sites.siteEntry as unknown[]).find(site =>
    record(site) && site.siteUrl === input.property && PERMISSIONS.has(String(site.permissionLevel)))
  if (!member) throw new Error('GSC_PROPERTY_ACCESS_NOT_VERIFIED')
  const response = await json(await fetcher(
    HOST + '/webmasters/v3/sites/' + encodeURIComponent(input.property) + '/searchAnalytics/query',
    {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      redirect: 'error',
      body: JSON.stringify({
        startDate: input.startDate, endDate: input.endDate,
        dimensions: ['query','page'], type: 'web', dataState: 'final',
        rowLimit: limit,
      }),
    },
  ))
  if (!record(response) || (response.rows !== undefined && !Array.isArray(response.rows))) {
    throw new Error('GSC_ANALYTICS_MALFORMED')
  }
  const rawRows = (response.rows ?? []) as unknown[]
  const rows: GscObservation[] = rawRows.map((row,i) => {
    if (!record(row) || !Array.isArray(row.keys) || row.keys.length !== 2
      || row.keys.some(x => typeof x !== 'string' || !x.trim())) {
      throw new Error('GSC_ROW_MALFORMED')
    }
    const page = row.keys[1] as string
    if (!belongsToProperty(input.property,page) || hostFor(page) !== ownedHost) {
      // Reject the whole observation batch rather than leaking a URL belonging
      // to another business/host through the internal mission system.
      throw new Error('GSC_RESULT_OUTSIDE_OWNED_SITE')
    }
    const clicks=metric(row.clicks), impressions=metric(row.impressions),
      ctr=metric(row.ctr), position=metric(row.position)
    if (ctr > 1 || clicks > impressions || position <= 0) throw new Error('GSC_METRIC_INCONSISTENT')
    return {
      id: 'gsc:' + input.property + ':' + input.endDate + ':' + i,
      property: input.property, query: (row.keys[0] as string).trim(), page,
      clicks, impressions, ctr, position,
      period: { startDate: input.startDate, endDate: input.endDate },
      retrievedAt: input.retrievedAt, source: 'GOOGLE_SEARCH_CONSOLE_API' as const,
      evidenceStatus: 'PROVIDER_OBSERVED_NOT_CONVERSION' as const,
      externalActionAuthorized: false as const,
    }
  })
  return {
    property: input.property, retrievedAt: input.retrievedAt,
    dateRange: { startDate: input.startDate, endDate: input.endDate },
    rows,
    // Google's query API does not promise exhaustive query coverage even
    // when fewer than the requested number of rows are returned.
    truncatedOrIncomplete: true,
    revenueVerified: false, externalActionAuthorized: false,
  }
}
