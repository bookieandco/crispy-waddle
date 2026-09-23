export type RecoveryAuthorityRole =
  | "COUNTY_JAIL_OR_SHERIFF"
  | "STATE_DEPARTMENT_OF_CORRECTIONS"
  | "COUNTY_CONTROLLER_OR_AUDITOR"
  | "COUNTY_TREASURER"
  | "STATE_TREASURER_OR_UNCLAIMED_PROPERTY"

export type RecoveryDiscoveryHint = {
  name?: string
  url?: string
  allowedUse?: string
  requiresOfficialConfirmation?: boolean
}

export type RecoverySearchRequest = {
  query: string
  authorityRole: RecoveryAuthorityRole
  stateCode?: string
  countyName?: string
  desiredSourceTypes?: string[]
  discoveryHints?: RecoveryDiscoveryHint[]
  maxResults?: number
}

export type RecoverySourceCandidate = {
  sourceName: string
  sourceUrl: string
  sourceKind: "API" | "JSON" | "CSV" | "XLSX" | "PDF" | "DOWNLOAD" | "INFO_PAGE" | "HTML" | "PORTAL"
  authorityName: string
  officialSourceVerified: boolean
  accessReviewApproved: false
  reason: string
  evidence: {
    title: string
    snippet: string
    observedAt: string
    governmentDomain: boolean
    roleRelevant: boolean
    fundsRelevant: boolean
  }
}

type SearchResult = {
  title?: string
  url?: string
  snippet?: string
  publishedAt?: string
}

const AUTHORITY_SIGNALS: Record<RecoveryAuthorityRole, readonly string[]> = {
  COUNTY_JAIL_OR_SHERIFF: ["sheriff", "jail", "detention", "corrections"],
  STATE_DEPARTMENT_OF_CORRECTIONS: ["department of corrections", "corrections", "doc", "prison"],
  COUNTY_CONTROLLER_OR_AUDITOR: ["controller", "auditor", "comptroller", "finance"],
  COUNTY_TREASURER: ["treasurer", "treasury", "finance"],
  STATE_TREASURER_OR_UNCLAIMED_PROPERTY: ["treasurer", "treasury", "unclaimed property", "unclaimed funds"],
}

const FUND_SIGNALS = [
  "inmate trust",
  "trust account",
  "commissary",
  "release funds",
  "release check",
  "release card",
  "unclaimed",
  "property",
  "held cash",
  "account balance",
]

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    return url.protocol === "https:" || url.protocol === "http:" ? url : null
  } catch {
    return null
  }
}

export function isGovernmentDomain(rawUrl: string): boolean {
  const url = safeUrl(rawUrl)
  if (!url) return false
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
  return hostname === "gov" || hostname.endsWith(".gov")
}

function containsAny(text: string, signals: readonly string[]): boolean {
  const haystack = text.toLowerCase()
  return signals.some(signal => haystack.includes(signal))
}

export function inferRecoverySourceKind(rawUrl: string, title = "", snippet = ""): RecoverySourceCandidate["sourceKind"] {
  const url = safeUrl(rawUrl)
  const path = url?.pathname.toLowerCase() || ""
  const combined = `${title} ${snippet}`.toLowerCase()

  if (/\.json(?:$|\?)/.test(path) || combined.includes("api")) return "JSON"
  if (/\.csv(?:$|\?)/.test(path)) return "CSV"
  if (/\.xlsx?(?:$|\?)/.test(path)) return "XLSX"
  if (/\.pdf(?:$|\?)/.test(path)) return "PDF"
  if (/(download|export|spreadsheet|dataset)/.test(combined)) return "DOWNLOAD"
  if (/(search|lookup|claim search|portal)/.test(combined) || /\/(search|lookup|claim)/.test(path)) return "PORTAL"
  if (/(list|roster|ledger|table)/.test(combined)) return "HTML"
  return "INFO_PAGE"
}

export function candidateFromSearchResult(
  request: RecoverySearchRequest,
  result: SearchResult,
  now = new Date().toISOString(),
): RecoverySourceCandidate | null {
  const sourceUrl = clean(result.url)
  const parsed = safeUrl(sourceUrl)
  if (!parsed) return null

  const title = clean(result.title) || parsed.hostname
  const snippet = clean(result.snippet)
  const evidenceText = `${title} ${snippet} ${parsed.pathname.replace(/[-_/]+/g, " ")}`
  const governmentDomain = isGovernmentDomain(sourceUrl)
  const roleRelevant = containsAny(evidenceText, AUTHORITY_SIGNALS[request.authorityRole])
  const fundsRelevant = containsAny(evidenceText, FUND_SIGNALS)
  const officialSourceVerified = governmentDomain && roleRelevant && fundsRelevant

  return {
    sourceName: title,
    sourceUrl,
    sourceKind: inferRecoverySourceKind(sourceUrl, title, snippet),
    authorityName: parsed.hostname,
    officialSourceVerified,
    accessReviewApproved: false,
    reason: officialSourceVerified
      ? "Government-domain source is relevant to both the requested authority role and inmate/unclaimed funds. Automation access still requires separate review."
      : "Discovery candidate only. Official authority and funds relevance were not both established from the search evidence.",
    evidence: {
      title,
      snippet,
      observedAt: clean(result.publishedAt) || now,
      governmentDomain,
      roleRelevant,
      fundsRelevant,
    },
  }
}

export function buildRecoverySearchQuery(request: RecoverySearchRequest): string {
  const base = clean(request.query)
  const hintNames = (Array.isArray(request.discoveryHints) ? request.discoveryHints : [])
    .slice(0, 8)
    .map(hint => clean(hint?.name))
    .filter(Boolean)
  return [base, ...new Set(hintNames)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

export async function searchRecoverySources(request: RecoverySearchRequest): Promise<RecoverySourceCandidate[]> {
  const endpoint = process.env.WEB_SEARCH_URL
  const apiKey = process.env.WEB_SEARCH_API_KEY
  if (!endpoint || !apiKey) {
    throw new Error("JHADINA_WEB_SEARCH_NOT_CONFIGURED")
  }

  const query = buildRecoverySearchQuery(request)
  if (!query || query.length > 700) throw new Error("RECOVERY_SEARCH_QUERY_INVALID")

  const maxResults = Math.max(1, Math.min(Number(request.maxResults || 8), 20))
  const url = new URL(endpoint)
  url.searchParams.set("q", query)
  url.searchParams.set("freshness", "3650")

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) throw new Error(`JHADINA_WEB_SEARCH_HTTP_${response.status}`)
  const payload = await response.json() as { results?: SearchResult[] }
  const seen = new Set<string>()
  const candidates: RecoverySourceCandidate[] = []

  for (const result of payload.results || []) {
    const candidate = candidateFromSearchResult(request, result)
    if (!candidate || seen.has(candidate.sourceUrl)) continue
    seen.add(candidate.sourceUrl)
    candidates.push(candidate)
    if (candidates.length >= maxResults) break
  }

  return candidates.sort((a, b) => {
    const score = (value: RecoverySourceCandidate) =>
      (value.officialSourceVerified ? 100 : 0)
      + (value.evidence.governmentDomain ? 20 : 0)
      + (value.evidence.roleRelevant ? 10 : 0)
      + (value.evidence.fundsRelevant ? 10 : 0)
    return score(b) - score(a)
  })
}
