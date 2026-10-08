import { describe, expect, it } from "vitest"
import { createProductionQuipGenerator, parseLiveQuipCandidates } from "./live-quip-provider"
import { decideBehavior, emptyPersonalityState } from "@jhadina/core-spine"

const context = {
  activeTask: "Make a funny observation about the toaster.",
  semanticAnswer: "The toaster keeps burning toast.",
  allowProfanity: false,
}

describe("live candidate ingestion is evidence-bounded", () => {
  it("rejects model-supplied objects, extra facts, manufactured shared history and unsupported numerals", () => {
    const result = parseLiveQuipCandidates(JSON.stringify({ candidates: [
      "That toaster is getting fired for burning toast.",
      { text: "toaster", score: 999, authority: "execute" },
      "Remember that time your toaster embarrassed you?",
      "The toaster burned 9 people yesterday.",
      "the sky is the limit",
    ] }), context)
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain("toaster")
    expect(result[0].truthCompatibility).toBeLessThanOrEqual(1)
  })

  it("returns no joke for malformed, empty, repeated or off-topic output", () => {
    expect(parseLiveQuipCandidates("not json", context)).toEqual([])
    expect(parseLiveQuipCandidates('{"candidates":[]}', context)).toEqual([])
    expect(parseLiveQuipCandidates('{"candidates":["Bananas are flying","Bananas are flying"]}', context)).toEqual([])
  })

  it("honors strict profanity eligibility", () => {
    const raw = '{"candidates":["That toaster is a damn menace."]}'
    expect(parseLiveQuipCandidates(raw, context)).toEqual([])
    expect(parseLiveQuipCandidates(raw, { ...context, allowProfanity: true })).toHaveLength(1)
  })
})

describe("production-ready opt-in provider selection", () => {
  const personality = emptyPersonalityState("2026-10-08T12:00:00Z")
  const decision = decideBehavior({
    ...personality,
    voice: { ...personality.voice!, humor: 1, quipFrequency: 1 },
  }, { register: "playful" })

  it("does not create a billable provider unless explicitly enabled", () => {
    expect(createProductionQuipGenerator(context, {
      enabled: false,
      provider: "gemini",
      geminiKey: "test-only",
    })).toBeUndefined()
  })

  it("reuses existing Gemini credentials via its native structured JSON response", async () => {
    const calls: Array<{ url: string; headers: HeadersInit | undefined }> = []
    const mockFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init?.headers })
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"candidates":["The toaster is having another burnout streak."]}' }] } }],
      }), { status: 200 })
    }) as typeof fetch

    const generator = createProductionQuipGenerator(context, {
      enabled: true,
      provider: "gemini",
      geminiKey: "test-only",
      fetchImpl: mockFetch,
    })
    expect(generator).toBeDefined()
    const suggestions = await generator!.generate({ decision, maximumCandidates: 3 })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.text).toContain("toaster")
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toContain("generativelanguage.googleapis.com")
    expect(calls[0]?.headers).toMatchObject({ "x-goog-api-key": "test-only" })
  })

  it("returns no candidates for provider refusal or transport errors", async () => {
    const errorFetch = (async () => new Response("", { status: 429 })) as typeof fetch
    const networkFetch = (async () => { throw new Error("offline") }) as typeof fetch
    for (const fetchImpl of [errorFetch, networkFetch]) {
      const generator = createProductionQuipGenerator(context, {
        enabled: true,
        provider: "gemini",
        geminiKey: "test-only",
        fetchImpl,
      })
      expect(await generator!.generate({ decision, maximumCandidates: 3 })).toEqual([])
    }
  })

  it("does not call a provider in serious mode", async () => {
    let called = false
    const generator = createProductionQuipGenerator(context, {
      enabled: true,
      provider: "gemini",
      geminiKey: "test-only",
      fetchImpl: (async () => { called = true; throw Error("must not call") }) as typeof fetch,
    })
    const serious = decideBehavior(personality, { distress: true, register: "playful" })
    expect(await generator!.generate({ decision: serious, maximumCandidates: 3 })).toEqual([])
    expect(called).toBe(false)
  })
})
