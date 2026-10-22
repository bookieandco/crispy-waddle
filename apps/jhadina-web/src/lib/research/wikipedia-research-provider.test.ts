import { describe, expect, it, vi } from "vitest"
import {
  createWikipediaResearchClient,
  extractWikipediaQuery,
  wikipediaToEvidence,
} from "./wikipedia-research-provider"
import { createWikipediaAugmentedKnowledgeContextProvider } from "./wikipedia-knowledge-context-provider"

function response(pages: unknown[], status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ query: { pages } }), { status, headers })
}

const page = {
  pageid: 123,
  title: "Ada Lovelace",
  extract: "Ada Lovelace wrote about the Analytical Engine.",
  fullurl: "https://en.wikipedia.org/wiki/Ada_Lovelace",
  revisions: [{ revid: 123456, timestamp: "2026-10-20T10:00:00Z" }],
  index: 1,
}

describe("JHADINA-KNOWLEDGE.WIKIPEDIA.01-.05", () => {
  it("only exports deliberate, non-private encyclopedia queries", () => {
    expect(extractWikipediaQuery("Search Wikipedia for Ada Lovelace")).toBe("Ada Lovelace")
    expect(extractWikipediaQuery("Who was Ada Lovelace?")).toBe("Ada Lovelace")
    expect(extractWikipediaQuery("What is the history of jazz?")).toBe("the history of jazz")
    expect(extractWikipediaQuery("Tell me about my daughter")).toBeNull()
    expect(extractWikipediaQuery("Search Wikipedia for my medical record")).toBeNull()
    expect(extractWikipediaQuery("Tell me about alice@example.com")).toBeNull()
    expect(extractWikipediaQuery("Deploy the app and use my secrets")).toBeNull()
    expect(extractWikipediaQuery("How much money is in my wallet?")).toBeNull()
  })

  it("queries only the fixed Wikimedia host with identity, read-only extracts, revision and attribution", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([page]))
    const wiki = createWikipediaResearchClient({ fetcher, now: () => Date.parse("2026-10-22T12:00:00Z") })
    const result = await wiki("Ada Lovelace")
    expect(result.status).toBe("ok")
    expect(result.articles).toHaveLength(1)
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.origin).toBe("https://en.wikipedia.org")
    expect(parsed.pathname).toBe("/w/api.php")
    expect(parsed.searchParams.get("action")).toBe("query")
    expect(parsed.searchParams.get("generator")).toBe("search")
    expect(parsed.searchParams.get("explaintext")).toBe("1")
    expect(parsed.searchParams.get("rvprop")).toBe("ids|timestamp")
    expect(init.method).toBe("GET")
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("github.com/bookieandco/crispy-waddle")
    expect(init.redirect).toBe("error")
    const evidence = wikipediaToEvidence(result)
    expect(evidence.knowledge[0]).toMatchObject({ source: "wikipedia-action-api", immutable: false })
    expect(evidence.knowledge[0]?.summary).toContain("https://en.wikipedia.org/w/index.php?oldid=123456")
    expect(evidence.knowledge[0]?.summary).toContain("UNVERIFIED")
    expect(evidence.knowledge[0]?.summary).toContain("License: CC BY-SA")
  })

  it("discards external URLs and missing/extractless pages and caps source text", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([
      { ...page, fullurl: "https://outside.example/hijack", extract: "a".repeat(3000) },
      { ...page, pageid: 44, missing: true },
      { ...page, pageid: 45, extract: "" },
    ]))
    const result = await createWikipediaResearchClient({ fetcher })("Ada Lovelace")
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0]?.url).toBe("https://en.wikipedia.org/wiki/Ada_Lovelace")
    expect(result.articles[0]?.excerpt.length).toBeLessThanOrEqual(680)
  })

  it("uses only a bounded process-local cache with TTL, not durable Memory", async () => {
    let current = 100_000
    const fetcher = vi.fn().mockResolvedValue(response([page]))
    const wiki = createWikipediaResearchClient({ fetcher, now: () => current })
    await wiki("Ada Lovelace")
    await wiki("ADA   LOVELACE")
    expect(fetcher).toHaveBeenCalledTimes(1)
    current += 15 * 60 * 1000 + 1
    await wiki("Ada Lovelace")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("honors Retry-After on 429 without retry bursts", async () => {
    let current = 100_000
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "30" } }))
      .mockResolvedValueOnce(response([page]))
    const wiki = createWikipediaResearchClient({ fetcher, now: () => current })
    expect((await wiki("Ada Lovelace")).status).toBe("rate_limited")
    expect((await wiki("Other topic")).status).toBe("rate_limited")
    expect(fetcher).toHaveBeenCalledTimes(1)
    current += 31_000
    expect((await wiki("Ada Lovelace")).status).toBe("ok")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("fails closed for upstream errors and doesn't invent evidence", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("bad", { status: 500 }))
    const result = await createWikipediaResearchClient({ fetcher })("Ada Lovelace")
    expect(result.status).toBe("unavailable")
    expect(wikipediaToEvidence(result).knowledge).toEqual([])
  })

  it("keeps normal Ask traffic entirely on the existing canonical provider", async () => {
    const canonical = { getContext: vi.fn().mockResolvedValue({ knowledge: [{ id: "canonical", source: "knowledge-core", summary: "Owner knowledge", observedAt: "2026-10-22", immutable: false }], limitations: [] }) }
    const wiki = vi.fn()
    const provider = createWikipediaAugmentedKnowledgeContextProvider(canonical, wiki)
    const result = await provider.getContext({ userId: "owner", activeTask: "Continue the existing work" })
    expect(wiki).not.toHaveBeenCalled()
    expect(result.knowledge).toHaveLength(1)
  })

  it("augments—not overwrites—the canonical K-1.5 provider with marked public evidence", async () => {
    const canonical = { getContext: vi.fn().mockResolvedValue({ knowledge: [{ id: "canonical", source: "knowledge-core", observedAt: "2026-10-22", summary: "Verified owner context", immutable: false }], limitations: [] }) }
    const wiki = vi.fn().mockResolvedValue({ status: "ok", articles: [{
      id: 123, title: "Ada Lovelace", excerpt: "Computing pioneer", url: "https://en.wikipedia.org/wiki/Ada_Lovelace",
      revisionId: 123456, revisionUrl: "https://en.wikipedia.org/w/index.php?oldid=123456",
      retrievedAt: "2026-10-22T12:00:00Z", license: "CC BY-SA; check article attribution and license",
    }], limitations: ["Community-edited"] })
    const provider = createWikipediaAugmentedKnowledgeContextProvider(canonical, wiki)
    const result = await provider.getContext({ userId: "owner", activeTask: "Who was Ada Lovelace?" })
    expect(wiki).toHaveBeenCalledWith("Ada Lovelace")
    expect(result.knowledge.map((ref) => ref.source)).toEqual(["wikipedia-action-api", "knowledge-core"])
    expect(result.limitations.join(" ")).toContain("read-only")
    expect(result.limitations.join(" ")).toContain("Community-edited")
  })

  it("preserves Wikipedia evidence with canonical outage labeled, not promoted as verification", async () => {
    const canonical = { getContext: vi.fn().mockRejectedValue(new Error("db offline")) }
    const wiki = vi.fn().mockResolvedValue({ status: "ok", articles: [], limitations: ["No matches"] })
    const provider = createWikipediaAugmentedKnowledgeContextProvider(canonical, wiki)
    const result = await provider.getContext({ userId: "owner", activeTask: "Who was Ada Lovelace?" })
    expect(result.knowledge).toHaveLength(0)
    expect(result.limitations.join(" ")).toContain("canonical Knowledge runtime unavailable")
    expect(result.limitations.join(" ")).toContain("No matches")
  })
})
