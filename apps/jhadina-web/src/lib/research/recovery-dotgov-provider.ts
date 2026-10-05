import {
  DOTGOV_REGISTRY_CSV_URL,
  US_STATE_NAMES,
  matchDotGovDomainToJurisdiction,
  normalizeGovernmentOrganization,
  parseDotGovRegistryCsv,
  type DotGovRegistryRecord,
  type PublicJurisdictionLevel,
  type UsStateOrDcCode,
} from "@jhadina/opportunity-core"
import type { RecoveryAuthorityRole, RecoverySearchRequest } from "./source-discovery-provider"

export type RecoveryOfficialDomainResult = {
  title: string
  url: string
  snippet: string
  publishedAt?: string
}

type RegistryCache = {
  expiresAt: number
  records: DotGovRegistryRecord[]
}

const REGISTRY_TTL_MS = 24 * 60 * 60 * 1000
const MAX_HTML_BYTES = 1_500_000
let registryCache: RegistryCache | null = null

const ROLE_SIGNALS: Record<RecoveryAuthorityRole, readonly string[]> = {
  COUNTY_JAIL_OR_SHERIFF: ["sheriff", "jail", "detention", "corrections"],
  STATE_DEPARTMENT_OF_CORRECTIONS: ["department of corrections", "corrections", "prison"],
  COUNTY_CONTROLLER_OR_AUDITOR: ["controller", "auditor", "comptroller", "finance"],
  COUNTY_TREASURER: ["treasurer", "treasury", "finance"],
  STATE_TREASURER_OR_UNCLAIMED_PROPERTY: ["treasurer", "treasury", "unclaimed", "revenue", "tax"],
  TAX_COLLECTOR: ["tax collector", "collector", "treasurer", "tax"],
  TAX_COMMISSIONER: ["tax commissioner", "commissioner", "revenue", "tax"],
  SHERIFF: ["sheriff"],
  CLERK: ["clerk", "clerk of court"],
  RECORDER: ["recorder", "recording"],
  CONTROLLER: ["controller", "comptroller", "finance"],
  AUDITOR: ["auditor", "audit", "finance"],
}

const RECOVERY_LINK_SIGNALS = [
  "tax sale",
  "tax deed",
  "excess proceeds",
  "excess funds",
  "surplus proceeds",
  "surplus funds",
  "overage",
  "unclaimed",
  "claim",
  "treasurer",
  "tax collector",
  "sheriff",
  "auditor",
  "controller",
  "clerk",
  "recorder",
  "inmate trust",
  "trust account",
  "release funds",
  "commissary",
  "statute",
  "code",
  "law",
]

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function containsAny(value: string, signals: readonly string[]): boolean {
  const text = value.toLowerCase()
  return signals.some(signal => text.includes(signal))
}

function isGovernmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  return host.endsWith(".gov")
}

function sameOfficialDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  const root = domain.toLowerCase().replace(/\.$/, "")
  return host === root || host.endsWith("." + root)
}

function safeOfficialUrl(raw: string, domain: string): URL | null {
  try {
    const url = new URL(raw)
    if (!["http:", "https:"].includes(url.protocol)) return null
    if (!isGovernmentHost(url.hostname) || !sameOfficialDomain(url.hostname, domain)) return null
    url.hash = ""
    return url
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, " & ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function htmlTitle(html: string): string {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return clean(match ? stripHtml(match[1] || "") : "")
}

function recoveryCountyNameVariants(name: string): string[] {
  const raw = clean(name).replace(/,.*$/, "")
  const stripped = raw
    .replace(/\s+(city and borough|census area|municipality|borough|parish|county)$/i, "")
    .trim()
  return [...new Set([raw, stripped].filter(Boolean))]
}

function registryCandidates(request: RecoverySearchRequest) {
  const state = clean(request.stateCode).toUpperCase()
  if (!(state in US_STATE_NAMES)) return []
  const stateCode = state as UsStateOrDcCode
  const level: PublicJurisdictionLevel = request.countyName ? "county" : "state"
  const names = request.countyName
    ? recoveryCountyNameVariants(request.countyName)
    : [US_STATE_NAMES[stateCode]]

  return names.map((name, index) => ({
    id: `recovery:${stateCode}:${level}:${index}`,
    level,
    state: stateCode,
    name,
    normalizedName: normalizeGovernmentOrganization(name),
  }))
}

function registryDomainScore(
  record: DotGovRegistryRecord,
  request: RecoverySearchRequest,
  matchScore: number,
): number {
  const evidence = clean([
    record.organization,
    record.suborganization,
    record.city,
    record.domain,
  ].filter(Boolean).join(" "))
  return matchScore
    + (containsAny(evidence, ROLE_SIGNALS[request.authorityRole]) ? 0.35 : 0)
    + (containsAny(evidence, RECOVERY_LINK_SIGNALS) ? 0.15 : 0)
}

async function loadRegistry(fetchImpl: typeof fetch, nowMs: number): Promise<DotGovRegistryRecord[]> {
  if (registryCache && registryCache.expiresAt > nowMs) return registryCache.records
  const response = await fetchImpl(DOTGOV_REGISTRY_CSV_URL, {
    headers: {
      accept: "text/csv,text/plain",
      "user-agent": "Jhadina-Recovery-DotGov-Discovery/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`RECOVERY_DOTGOV_REGISTRY_HTTP_${response.status}`)
  const records = parseDotGovRegistryCsv(await response.text())
  registryCache = { records, expiresAt: nowMs + REGISTRY_TTL_MS }
  return records
}

export function resetRecoveryDotGovRegistryCacheForTests(): void {
  registryCache = null
}

export async function resolveRecoveryOfficialDomains(
  request: RecoverySearchRequest,
  input: { fetchImpl?: typeof fetch; nowMs?: number; maxDomains?: number } = {},
): Promise<Array<{ domain: string; organization: string; score: number }>> {
  const candidates = registryCandidates(request)
  if (!candidates.length) return []
  const stateCode = candidates[0]!.state
  const level = candidates[0]!.level
  const records = await loadRegistry(input.fetchImpl ?? fetch, input.nowMs ?? Date.now())
  const rows: Array<{ domain: string; organization: string; score: number }> = []

  for (const record of records) {
    if (record.state !== stateCode) continue
    if (record.domainType !== level) continue
    const match = matchDotGovDomainToJurisdiction(record, candidates)
    if (!match) continue
    rows.push({
      domain: record.domain,
      organization: record.suborganization
        ? `${record.organization} — ${record.suborganization}`
        : record.organization,
      score: registryDomainScore(record, request, match.score),
    })
  }

  const unique = new Map<string, { domain: string; organization: string; score: number }>()
  for (const row of rows.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain))) {
    if (!unique.has(row.domain)) unique.set(row.domain, row)
  }
  return [...unique.values()].slice(0, Math.max(1, Math.min(input.maxDomains ?? 4, 8)))
}

type FetchedPage = {
  url: string
  title: string
  text: string
  html: string
}

async function fetchOfficialPage(
  rawUrl: string,
  domain: string,
  fetchImpl: typeof fetch,
): Promise<FetchedPage | null> {
  const url = safeOfficialUrl(rawUrl, domain)
  if (!url) return null
  const response = await fetchImpl(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Jhadina-Recovery-DotGov-Discovery/1.0",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return null
  const resolved = safeOfficialUrl(response.url || url.toString(), domain)
  if (!resolved) return null
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.toLowerCase().includes("text/html")) return null
  const html = (await response.text()).slice(0, MAX_HTML_BYTES)
  return {
    url: resolved.toString(),
    title: htmlTitle(html) || domain,
    text: stripHtml(html).slice(0, 12_000),
    html,
  }
}

function extractRecoveryLinks(page: FetchedPage, domain: string): Array<{ url: string; text: string; score: number }> {
  const rows: Array<{ url: string; text: string; score: number }> = []
  const pattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(page.html))) {
    const href = clean(match[1] || match[2] || match[3])
    const anchor = clean(stripHtml(match[4] || ""))
    if (!href) continue
    let resolved: URL
    try {
      resolved = new URL(href, page.url)
    } catch {
      continue
    }
    const safe = safeOfficialUrl(resolved.toString(), domain)
    if (!safe) continue
    const evidence = `${anchor} ${safe.pathname.replace(/[-_/]+/g, " ")}`
    if (!containsAny(evidence, RECOVERY_LINK_SIGNALS)) continue
    const score =
      (containsAny(evidence, ["excess proceeds", "excess funds", "surplus", "overage"]) ? 50 : 0)
      + (containsAny(evidence, ["tax sale", "tax deed"]) ? 25 : 0)
      + (containsAny(evidence, ["treasurer", "tax collector", "sheriff", "auditor", "controller"]) ? 15 : 0)
      + (containsAny(evidence, ["statute", "code", "law"]) ? 10 : 0)
    rows.push({ url: safe.toString(), text: anchor || safe.pathname, score })
  }

  const unique = new Map<string, { url: string; text: string; score: number }>()
  for (const row of rows.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))) {
    if (!unique.has(row.url)) unique.set(row.url, row)
  }
  return [...unique.values()].slice(0, 12)
}

export async function searchRecoveryOfficialDomains(
  request: RecoverySearchRequest,
  input: { fetchImpl?: typeof fetch; now?: string; maxDomains?: number } = {},
): Promise<RecoveryOfficialDomainResult[]> {
  const fetchImpl = input.fetchImpl ?? fetch
  const now = input.now ?? new Date().toISOString()
  const domains = await resolveRecoveryOfficialDomains(request, {
    fetchImpl,
    nowMs: Date.parse(now) || Date.now(),
    maxDomains: input.maxDomains,
  })
  const results: RecoveryOfficialDomainResult[] = []

  for (const entry of domains) {
    const root = await fetchOfficialPage(`https://${entry.domain}/`, entry.domain, fetchImpl)
    if (!root) continue

    results.push({
      title: root.title,
      url: root.url,
      snippet: root.text.slice(0, 1200),
      publishedAt: now,
    })

    const links = extractRecoveryLinks(root, entry.domain)
    for (const link of links) {
      results.push({
        title: `${root.title} — ${link.text}`,
        url: link.url,
        snippet: `${entry.organization}. ${link.text}`,
        publishedAt: now,
      })
    }

    for (const link of links.slice(0, 3)) {
      const page = await fetchOfficialPage(link.url, entry.domain, fetchImpl)
      if (!page) continue
      results.push({
        title: page.title,
        url: page.url,
        snippet: page.text.slice(0, 1600),
        publishedAt: now,
      })
      for (const nested of extractRecoveryLinks(page, entry.domain).slice(0, 8)) {
        results.push({
          title: `${page.title} — ${nested.text}`,
          url: nested.url,
          snippet: `${entry.organization}. ${nested.text}`,
          publishedAt: now,
        })
      }
    }
  }

  const unique = new Map<string, RecoveryOfficialDomainResult>()
  for (const result of results) {
    const current = unique.get(result.url)
    if (!current || result.snippet.length > current.snippet.length) unique.set(result.url, result)
  }
  return [...unique.values()].slice(0, 60)
}
