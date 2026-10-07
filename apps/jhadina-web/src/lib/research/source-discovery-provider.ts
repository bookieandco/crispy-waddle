import { createHash } from "node:crypto"

export type RecoveryAuthorityRole =
  | "COUNTY_JAIL_OR_SHERIFF"
  | "STATE_DEPARTMENT_OF_CORRECTIONS"
  | "COUNTY_CONTROLLER_OR_AUDITOR"
  | "COUNTY_TREASURER"
  | "STATE_TREASURER_OR_UNCLAIMED_PROPERTY"
  | "TAX_COLLECTOR"
  | "TAX_COMMISSIONER"
  | "SHERIFF"
  | "CLERK"
  | "RECORDER"
  | "CONTROLLER"
  | "AUDITOR"
  | "FINANCE"
  | "PUBLIC_RECORDS_OFFICER"

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

export type PublicRecordsContactMetadata = {
  agencyName?: string
  custodianName?: string
  custodianTitle?: string
  email?: string
  phone?: string
  mailingAddress?: string
  portalUrl?: string
  departmentUrl?: string
  acceptedChannels: Array<"EMAIL" | "WEB_FORM" | "PORTAL" | "MAIL" | "OTHER">
  sourceSha256: string
  extractionConfidence: number
  acceptsRecordsRequests: boolean
  notes?: string
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
    recordsRelevant: boolean
    publishedAt?: string
  }
  contactMetadata?: PublicRecordsContactMetadata
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
  TAX_COLLECTOR: ["tax collector", "collector", "tax office"],
  TAX_COMMISSIONER: ["tax commissioner", "commissioner", "tax office"],
  SHERIFF: ["sheriff", "sheriff's office"],
  CLERK: ["clerk", "clerk of court", "court clerk"],
  RECORDER: ["recorder", "recorder's office", "recording"],
  CONTROLLER: ["controller", "comptroller", "finance"],
  AUDITOR: ["auditor", "audit", "finance"],
  FINANCE: ["finance", "financial services", "controller", "auditor", "treasurer"],
  PUBLIC_RECORDS_OFFICER: ["public records", "open records", "records officer", "records custodian", "foia"],
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
  "tax sale",
  "tax deed",
  "excess proceeds",
  "excess funds",
  "surplus proceeds",
  "surplus funds",
  "overage",
]

const PUBLIC_RECORDS_SIGNALS = [
  "public records",
  "public record request",
  "records request",
  "open records",
  "open record request",
  "records custodian",
  "records officer",
  "freedom of information",
  "foia",
  "right to know",
  "sunshine",
]

function wantsPublicRecordsContact(request: RecoverySearchRequest): boolean {
  return (request.desiredSourceTypes || []).some(value =>
    ["PUBLIC_RECORDS_CONTACT", "OPEN_RECORDS_CONTACT"].includes(clean(value).toUpperCase()),
  )
}

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
  const evidenceText = `${title} ${snippet} ${parsed.hostname} ${parsed.pathname.replace(/[-_/]+/g, " ")}`
  const governmentDomain = isGovernmentDomain(sourceUrl)
  const roleRelevant = containsAny(evidenceText, AUTHORITY_SIGNALS[request.authorityRole])
  const fundsRelevant = containsAny(evidenceText, FUND_SIGNALS)
  const recordsRelevant = containsAny(evidenceText, PUBLIC_RECORDS_SIGNALS)
  const recordsContactIntent = wantsPublicRecordsContact(request)
  const subjectRelevant = recordsContactIntent ? recordsRelevant : fundsRelevant
  const officialSourceVerified = governmentDomain && roleRelevant && subjectRelevant

  return {
    sourceName: title,
    sourceUrl,
    sourceKind: inferRecoverySourceKind(sourceUrl, title, snippet),
    authorityName: parsed.hostname,
    officialSourceVerified,
    accessReviewApproved: false,
    reason: officialSourceVerified
      ? recordsContactIntent
        ? "Government-domain source is relevant to the requested authority role and public-records contact workflow. Contact/channel evidence still requires exact human review."
        : "Government-domain source is relevant to both the requested authority role and recovery-funds subject. Automation access still requires separate review."
      : recordsContactIntent
        ? "Discovery candidate only. Official authority and public-records relevance were not both established from the search evidence."
        : "Discovery candidate only. Official authority and funds relevance were not both established from the search evidence.",
    evidence: {
      title,
      snippet,
      observedAt: now,
      governmentDomain,
      roleRelevant,
      fundsRelevant,
      recordsRelevant,
      ...(clean(result.publishedAt) ? { publishedAt: clean(result.publishedAt) } : {}),
    },
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
}

function visibleText(html: string): string {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|p|div|li|tr|h[1-6]|section|article|address)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}

function resolveOfficialLink(baseUrl: string, href: string): string | undefined {
  try {
    const resolved = new URL(decodeHtml(href), baseUrl)
    if (!["http:", "https:"].includes(resolved.protocol)) return undefined
    if (!isGovernmentDomain(resolved.toString())) return undefined
    return resolved.toString()
  } catch {
    return undefined
  }
}

function extractAnchors(html: string): Array<{ href: string; text: string; raw: string }> {
  const rows: Array<{ href: string; text: string; raw: string }> = []
  const re = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    rows.push({ href: decodeHtml(match[2]), text: visibleText(match[4]), raw: match[0] })
  }
  return rows
}

function publicRecordsContext(value: string): boolean {
  return containsAny(value, PUBLIC_RECORDS_SIGNALS)
}

export function extractPublicRecordsContactMetadata(
  sourceUrl: string,
  html: string,
): PublicRecordsContactMetadata {
  const body = html.slice(0, 1_048_576)
  const textBody = visibleText(body)
  const normalized = textBody.toLowerCase()
  const anchors = extractAnchors(body)
  const recordsRelevant = publicRecordsContext(textBody)

  let email: string | undefined
  for (const anchor of anchors) {
    if (!anchor.href.toLowerCase().startsWith("mailto:")) continue
    const candidate = clean(anchor.href.slice(7).split("?")[0]).toLowerCase()
    const localContext = `${anchor.text} ${anchor.raw}`
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) && (publicRecordsContext(localContext) || recordsRelevant)) {
      email = candidate
      break
    }
  }

  let phone: string | undefined
  for (const anchor of anchors) {
    if (!anchor.href.toLowerCase().startsWith("tel:")) continue
    const candidate = clean(anchor.href.slice(4))
    if (candidate) { phone = candidate; break }
  }
  if (!phone) {
    const phoneMatch = textBody.match(/(?:\+?1[.\-\s]?)?\(?\d{3}\)?[.\-\s]\d{3}[.\-\s]\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d+)?/i)
    if (phoneMatch) phone = clean(phoneMatch[0])
  }

  let portalUrl: string | undefined
  let portalKind: "PORTAL" | "WEB_FORM" | undefined
  for (const anchor of anchors) {
    const label = `${anchor.text} ${anchor.href}`.toLowerCase()
    if (!publicRecordsContext(label) && !/(request|submit).*(portal|form)|(?:portal|form).*(request|submit)/i.test(label)) continue
    const resolved = resolveOfficialLink(sourceUrl, anchor.href)
    if (!resolved) continue
    portalUrl = resolved
    portalKind = /form/i.test(label) ? "WEB_FORM" : "PORTAL"
    break
  }

  const titleMatch = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const headingMatch = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  const agencyName = clean(headingMatch ? visibleText(headingMatch[1]) : titleMatch ? visibleText(titleMatch[1]) : "") || undefined
  const custodianTitleMatch = textBody.match(/\b(Public Records Officer|Open Records Officer|Records Custodian|Public Records Custodian|FOIA Officer)\b/i)
  const custodianTitle = custodianTitleMatch ? clean(custodianTitleMatch[0]) : undefined

  const explicitEmail = Boolean(email && recordsRelevant && /(?:email|send|submit|file)[^\n.]{0,120}(?:public |open )?records? request|(?:public |open )?records? request[^\n.]{0,120}(?:email|send|submit|file)/i.test(textBody))
  const explicitMail = recordsRelevant && /(?:mail|postal)[^\n.]{0,140}(?:public |open )?records? request|(?:public |open )?records? request[^\n.]{0,140}(?:mail|postal)/i.test(textBody)
  let mailingAddress: string | undefined
  if (explicitMail) {
    const addressMatch = textBody.match(/\b\d{1,6}\s+[A-Za-z0-9.'#\- ]{2,60}\s(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?|Highway|Hwy\.?)\b[^\n]{0,80}\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i)
    if (addressMatch) mailingAddress = clean(addressMatch[0])
  }

  const acceptedChannels: PublicRecordsContactMetadata["acceptedChannels"] = []
  if (explicitEmail) acceptedChannels.push("EMAIL")
  if (portalUrl && portalKind) acceptedChannels.push(portalKind)
  if (mailingAddress && explicitMail) acceptedChannels.push("MAIL")

  const acceptsRecordsRequests = recordsRelevant && acceptedChannels.length > 0
  const evidenceCount = [email, phone, mailingAddress, portalUrl, custodianTitle].filter(Boolean).length
  const extractionConfidence = acceptsRecordsRequests
    ? Math.min(0.98, 0.62 + evidenceCount * 0.06)
    : Math.min(0.55, 0.2 + evidenceCount * 0.05)

  return {
    ...(agencyName ? { agencyName } : {}),
    ...(custodianTitle ? { custodianTitle } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(mailingAddress ? { mailingAddress } : {}),
    ...(portalUrl ? { portalUrl } : {}),
    departmentUrl: sourceUrl,
    acceptedChannels,
    sourceSha256: createHash("sha256").update(body, "utf8").digest("hex"),
    extractionConfidence,
    acceptsRecordsRequests,
    notes: acceptsRecordsRequests
      ? "Extracted only from the fetched official government page; no inferred email address or private-person data."
      : "Official page did not explicitly establish an accepted written public-records submission channel.",
  }
}

async function enrichPublicRecordsCandidate(
  candidate: RecoverySourceCandidate,
  timeoutMs = 8_000,
): Promise<RecoverySourceCandidate> {
  if (!candidate.evidence.governmentDomain || !candidate.evidence.recordsRelevant) return candidate

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs))
  try {
    const response = await fetch(candidate.sourceUrl, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Jhadina-Public-Records-Contact/1.0" },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    })
    if (!response.ok) return candidate
    const finalUrl = response.url || candidate.sourceUrl
    if (!isGovernmentDomain(finalUrl)) return candidate
    const contentType = response.headers.get("content-type") || ""
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return candidate
    const contentLength = Number(response.headers.get("content-length") || 0)
    if (contentLength > 1_048_576) return candidate
    const html = (await response.text()).slice(0, 1_048_576)
    const contactMetadata = extractPublicRecordsContactMetadata(finalUrl, html)
    return { ...candidate, sourceUrl: finalUrl, contactMetadata }
  } catch {
    return candidate
  } finally {
    clearTimeout(timer)
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

  const sorted = candidates.sort((a, b) => {
    const score = (value: RecoverySourceCandidate) =>
      (value.officialSourceVerified ? 100 : 0)
      + (value.evidence.governmentDomain ? 20 : 0)
      + (value.evidence.roleRelevant ? 10 : 0)
      + (value.evidence.recordsRelevant ? 10 : 0)
      + (value.evidence.fundsRelevant ? 10 : 0)
    return score(b) - score(a)
  })

  if (!wantsPublicRecordsContact(request)) return sorted

  const enriched: RecoverySourceCandidate[] = []
  for (const [index, candidate] of sorted.entries()) {
    enriched.push(index < 3 ? await enrichPublicRecordsCandidate(candidate) : candidate)
  }
  return enriched
}
