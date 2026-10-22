/**
 * .08 Read-only public primary-source candidate review.
 * Independent public documents are inspected only after the owner selects a
 * candidate. Token overlap is not factual corroboration or source authenticity.
 * This intentionally never emits VERIFIED or writes canonical Knowledge.
 */
const ALLOWED_AUTHORITIES = [
  "loc.gov", "archives.gov", "govinfo.gov", "congress.gov", "nasa.gov",
  "noaa.gov", "usgs.gov", "nih.gov", "nps.gov", "si.edu",
  "history.state.gov", "computerhistory.org",
] as const

export function primarySourceCandidateUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 1800) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null
    if (!ALLOWED_AUTHORITIES.some(host => u.hostname === host || u.hostname.endsWith("." + host))) return null
    return u.toString()
  } catch { return null }
}

const STOP = new Set(["with","from","that","this","about","which","their","there","were","what","when","because","after","before","would","could","have","history","cite","reference","retrieved","accessed","source","https","www","http","journal","page","title","publisher","published"])

function signals(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z]{5,}/g)?.filter(term => !STOP.has(term)) ?? [])].slice(0, 80)
}

function visibleText(input: string): string {
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\{[^{}]{0,200}\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function boundedBody(response: Response, limit = 120_000): Promise<string | null> {
  if (!response.body) return null
  const reader = response.body.getReader()
  let size = 0
  const parts: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) return null
      parts.push(value)
    }
  } finally { await reader.cancel().catch(() => undefined) }
  const combined = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { combined.set(part, offset); offset += part.length }
  return new TextDecoder().decode(combined)
}

export type SourceReview = {
  status: "POTENTIAL_ALIGNMENT" | "NO_ALIGNMENT" | "UNAVAILABLE" | "NOT_ALLOWED"
  sourceUrl?: string
  sourceExcerpt?: string
  overlappingTerms?: string[]
  limitations: string[]
  independentlyVerified: false
}
export async function reviewPublicSourceCandidate(
  wikipediaText: string,
  candidate: string,
  fetcher: typeof fetch = fetch,
): Promise<SourceReview> {
  const url = primarySourceCandidateUrl(candidate)
  if (!url) return { status: "NOT_ALLOWED", independentlyVerified: false, limitations: ["Only HTTPS sources on the explicit public-institution allowlist can be inspected."] }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)
  const limitations = [
    "Public institutional domain is not proof this page supports the particular encyclopedia claim.",
    "Term overlap is a review cue only. Human/independent claim verification remains required.",
    "No source data is saved to canonical Knowledge or personal Memory.",
  ]
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { "User-Agent": "JhadinaResearch/0.2 (https://github.com/bookieandco/crispy-waddle)", "Accept": "text/html,text/plain" },
      signal: controller.signal,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
    })
    const type = (response.headers.get("Content-Type") ?? "").toLowerCase()
    if (!response.ok || !/^(text\/html|text\/plain)/.test(type) || Number(response.headers.get("Content-Length")) > 120_000) {
      return { status: "UNAVAILABLE", sourceUrl: url, independentlyVerified: false, limitations }
    }
    const raw = await boundedBody(response)
    if (!raw) return { status: "UNAVAILABLE", sourceUrl: url, independentlyVerified: false, limitations }
    const text = visibleText(raw)
    const tokens = signals(wikipediaText)
    const visibleTokens = new Set(signals(text.slice(0, 90_000)))
    const matches = tokens.filter(word => visibleTokens.has(word)).slice(0, 15)
    return {
      status: matches.length >= 3 ? "POTENTIAL_ALIGNMENT" : "NO_ALIGNMENT",
      sourceUrl: url,
      sourceExcerpt: text.slice(0, 650),
      overlappingTerms: matches,
      independentlyVerified: false,
      limitations,
    }
  } catch {
    return { status: "UNAVAILABLE", sourceUrl: url, independentlyVerified: false, limitations }
  } finally { clearTimeout(timer) }
}
