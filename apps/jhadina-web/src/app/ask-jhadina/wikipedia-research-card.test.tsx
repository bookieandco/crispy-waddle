import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { WikipediaResearchCard, wikipediaCitationUrl, safeReferenceLink } from "./wikipedia-research-card"

describe("ASK-WIKIPEDIA mobile citation presentation", () => {
  it("renders a revision-specific openable HTTPS citation without action authorization", () => {
    const html = renderToStaticMarkup(createElement(WikipediaResearchCard, {
      research: {
        status: "ok",
        articles: [{
          id: 123,
          title: "Ada Lovelace",
          excerpt: "A mathematician and writer.",
          url: "https://en.wikipedia.org/wiki/Ada_Lovelace",
          revisionUrl: "https://en.wikipedia.org/w/index.php?oldid=123456",
          revisionId: 123456,
          revisionAt: "2026-10-20T10:00:00Z",
          retrievedAt: "2026-10-22T12:00:00Z",
          license: "CC BY-SA; check article attribution and license",
        }],
        limitations: ["Independent sources not yet verified"],
      },
    }))
    expect(html).toContain("Wikipedia research sources")
    expect(html).toContain("oldid=123456")
    expect(html).toContain("Inspect references")
    expect(html).toContain("not independently verified")
    expect(html).not.toContain("Approval granted")
  })

  it("shows rate-limit instead of fabricated sources", () => {
    const html = renderToStaticMarkup(createElement(WikipediaResearchCard, {
      research: { status: "rate_limited", articles: [], limitations: ["Upstream 429"] },
    }))
    expect(html).toContain("rate-limited")
    expect(html).not.toContain("Open revision")
  })

  it("guards citation links against non-Wikipedia and dangerous schemes", () => {
    expect(wikipediaCitationUrl("https://en.wikipedia.org/w/index.php?oldid=12")).toContain("oldid=12")
    expect(wikipediaCitationUrl("https://evil.example/fake")).toBeUndefined()
    expect(wikipediaCitationUrl("javascript:alert(1)")).toBeUndefined()
    expect(wikipediaCitationUrl("https://en.wikipedia.org.evil.com/wiki/A")).toBeUndefined()
    expect(safeReferenceLink("javascript:alert(1)")).toBeUndefined()
  })
})
