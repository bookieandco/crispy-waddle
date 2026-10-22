import { describe, expect, it, vi } from "vitest"
import { primarySourceCandidateUrl, reviewPublicSourceCandidate } from "./wikipedia-primary-review"

describe("JHADINA-KNOWLEDGE.WIKIPEDIA.08 primary-source candidate review", () => {
  it("permits a limited list of HTTPS public institutions only", () => {
    expect(primarySourceCandidateUrl("https://www.loc.gov/item/abc")).toBe("https://www.loc.gov/item/abc")
    expect(primarySourceCandidateUrl("https://archives.gov/record")).toBe("https://archives.gov/record")
    expect(primarySourceCandidateUrl("https://archives.gov.evil.example/a")).toBeNull()
    expect(primarySourceCandidateUrl("http://nasa.gov/a")).toBeNull()
    expect(primarySourceCandidateUrl("https://127.0.0.1/a")).toBeNull()
    expect(primarySourceCandidateUrl("https://nasa.gov:8080/a")).toBeNull()
    expect(primarySourceCandidateUrl("https://user:pass@nasa.gov")).toBeNull()
  })

  it("compares independent text and NEVER promotes keyword overlap into verified fact", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html><main>Ada Lovelace mathematical analytical engine</main></html>", {
      status: 200, headers: { "Content-Type": "text/html" },
    }))
    const result = await reviewPublicSourceCandidate(
      "Ada Lovelace mathematical notes on the analytical engine",
      "https://www.loc.gov/item/123",
      fetcher as typeof fetch,
    )
    expect(result.status).toBe("POTENTIAL_ALIGNMENT")
    expect(result.independentlyVerified).toBe(false)
    expect(result.limitations.join(" ")).toContain("not proof")
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("error")
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe("omit")
    expect(result.sourceExcerpt).toContain("Ada Lovelace")
  })

  it("rejects redirects, unsupported content, and pages above the streamed size limit", async () => {
    const redirect = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/" } }))
    const a = await reviewPublicSourceCandidate("encyclopedia text", "https://nasa.gov/example", redirect as typeof fetch)
    expect(a.status).toBe("UNAVAILABLE")
    const pdf = vi.fn().mockResolvedValue(new Response("%PDF", { status: 200, headers: { "Content-Type": "application/pdf" } }))
    expect((await reviewPublicSourceCandidate("text", "https://nasa.gov/example", pdf as typeof fetch)).status).toBe("UNAVAILABLE")
    const huge = vi.fn().mockResolvedValue(new Response("x".repeat(140000), { status: 200, headers: { "Content-Type": "text/plain" } }))
    expect((await reviewPublicSourceCandidate("text", "https://nasa.gov/example", huge as typeof fetch)).status).toBe("UNAVAILABLE")
  })

  it("rejects arbitrary user-supplied URLs without even contacting a server", async () => {
    const fetcher = vi.fn()
    const result = await reviewPublicSourceCandidate("Ada Lovelace", "http://localhost/private", fetcher as typeof fetch)
    expect(result.status).toBe("NOT_ALLOWED")
    expect(result.independentlyVerified).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
