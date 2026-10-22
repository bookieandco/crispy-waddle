import {
  publicFeedUrl, type PublicFeedItem, type PublicFeedResult,
  type PublicFeedSource,
} from "@jhadina/social-core"

const MAX_FEED_BYTES = 256_000
const MAX_PER_SOURCE = 12

function textValue(xml: string): string {
  // Content is rendered as React text, never as HTML. No XML entity expansion.
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|#38);/g, "&")
    .replace(/&(?:lt|#60);/g, "<")
    .replace(/&(?:gt|#62);/g, ">")
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim().slice(0, 320)
}
function field(xml: string, name: string): string {
  const pattern = new RegExp(`<(?:[a-zA-Z]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z]+:)?${name}>`, "i")
  return pattern.exec(xml)?.[1] ?? ""
}
function linkValue(xml: string, isAtom: boolean): string {
  if (isAtom) {
    const matches = [...xml.matchAll(/<link\s+([^>]+?)\/?\s*>/gi)]
    const attrs = (matches.find(m => /rel=["']alternate["']/.test(m[1] ?? "")) ?? matches[0])?.[1] ?? ""
    return /\bhref=["']([^"']+)["']/i.exec(attrs)?.[1] ?? ""
  }
  return field(xml, "link")
}
function safeExternalLink(raw: string): string | null {
  try {
    const u = new URL(raw.trim().replace(/&amp;/g, "&"))
    if (u.protocol !== "https:" || u.username || u.password) return null
    return u.toString()
  } catch { return null }
}
export function parsePublicFeedXml(source: PublicFeedSource, xml: string): PublicFeedItem[] {
  if (xml.length > MAX_FEED_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) return []
  const atom = /<(?:\w+:)?feed(?:\s|>)/i.test(xml)
  const regex = atom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
    : /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  const items: PublicFeedItem[] = []
  const seen = new Set<string>()
  for (const match of xml.matchAll(regex)) {
    if (items.length >= MAX_PER_SOURCE) break
    const entry = match[1] ?? ""
    const url = safeExternalLink(linkValue(entry, atom))
    if (!url || seen.has(url)) continue
    const published = field(entry, atom ? "published" : "pubDate") || field(entry, "updated")
    const date = Date.parse(textValue(published))
    if (!Number.isFinite(date)) continue
    const title = textValue(field(entry, "title")).slice(0, 160) || source.label
    const summary = textValue(field(entry, atom ? "summary" : "description") ||
      field(entry, "content")).slice(0, 320)
    seen.add(url)
    items.push({
      id: source.label + ":" + url,
      sourceId: source.label, provider: source.provider,
      title, url, publishedAt: new Date(date).toISOString(),
      summary, provenance: "official_public_feed",
    })
  }
  return items
}
async function limitedText(response: Response): Promise<string> {
  const length = Number(response.headers.get("content-length"))
  if (Number.isFinite(length) && length > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE")
  if (!response.body) throw new Error("FEED_EMPTY_BODY")
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE")
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(all)
}

/** No arbitrary fetch targets, OAuth tokens, scraping, writes or redirects. */
export async function readPublicFeed(
  source: PublicFeedSource,
  fetcher: typeof fetch = fetch,
): Promise<PublicFeedResult> {
  try {
    const url = publicFeedUrl(source)
    const response = await fetcher(url, {
      method: "GET", redirect: "error", cache: "no-store",
      headers: { accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error("FEED_REQUEST_FAILED")
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (contentType && !/(?:xml|rss|atom)/.test(contentType)) {
      throw new Error("FEED_UNEXPECTED_CONTENT_TYPE")
    }
    const xml = await limitedText(response)
    return { source, state: "ok", items: parsePublicFeedXml(source, xml) }
  } catch {
    return { source, state: "unavailable", items: [] }
  }
}
