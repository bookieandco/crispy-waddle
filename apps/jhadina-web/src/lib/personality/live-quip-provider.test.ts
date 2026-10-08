import { describe, expect, it } from "vitest"
import { parseLiveQuipCandidates } from "./live-quip-provider"

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
