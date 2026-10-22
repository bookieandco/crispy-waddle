import { describe, expect, it, vi } from "vitest"
import { readWikipediaArticleDetails } from "./wikipedia-article-reader"

describe("Wikipedia article and citation inspection", () => {
  it("reads page IDs only from the trusted Action API and exposes reference candidates without verifying them", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      parse: {
        title: "Ada Lovelace",
        wikitext: {
          "*": "Ada was a mathematician <ref>{{cite journal|title=Original letter}}</ref> and a computing pioneer.",
        },
        externallinks: [
          "https://www.computerhistory.org/ada",
          "http://unsecured.example/untrusted",
          "https://www.computerhistory.org/ada",
          "https://archive.org/details/ada",
        ],
      },
    }), { status: 200 }))
    const result = await readWikipediaArticleDetails(123, { fetcher, now: () => 1_000 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.hostname).toBe("en.wikipedia.org")
    expect(parsed.searchParams.get("action")).toBe("parse")
    expect(parsed.searchParams.get("pageid")).toBe("123")
    expect(parsed.searchParams.get("prop")).toContain("externallinks")
    expect(init.method).toBe("GET")
    expect(result?.referenceSnippets[0]).toContain("Original letter")
    expect(result?.externalLinkCandidates).toEqual([
      "https://www.computerhistory.org/ada",
      "https://archive.org/details/ada",
    ])
    expect(result?.limitations.join(" ")).toContain("not independent corroboration")
  })

  it("rejects invalid IDs, API errors, and oversized responses without invented citations", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("oops", { status: 500 }))
    expect(await readWikipediaArticleDetails(-5, { fetcher })).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(await readWikipediaArticleDetails(88, { fetcher })).toBeNull()
    const oversized = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Length": "500000" } }))
    expect(await readWikipediaArticleDetails(88, { fetcher: oversized })).toBeNull()
  })

  it("caps article text and rejects missing revision text", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      parse: { title: "Ada Lovelace", wikitext: "x".repeat(35_000), externallinks: [] },
    }), { status: 200 }))
    const result = await readWikipediaArticleDetails(45, { fetcher })
    expect(result?.wikitextPreview.length).toBe(18_000)
    expect(result?.truncated).toBe(true)
    const empty = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      parse: { title: "Empty", wikitext: "" },
    }), { status: 200 }))
    expect(await readWikipediaArticleDetails(45, { fetcher: empty })).toBeNull()
  })
})
