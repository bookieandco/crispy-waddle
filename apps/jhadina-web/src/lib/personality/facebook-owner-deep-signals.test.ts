import { describe, expect, it } from "vitest"
import { deriveOwnerDeepWritingSignals } from "./facebook-owner-deep-signals"
import type { WritingSample } from "./facebook-owner-import"

const sample = (text: string, kind: "post" | "comment" = "post"): WritingSample =>
  ({ kind, text, source: "posts/your_posts_1.json", at: "2013-05-01T00:00:00Z" })

describe("FB-RELATE.DEEP.03-.04: owner-only heuristic writing review", () => {
  it("is silent below ten samples and never invents sarcasm or a joke from laughter alone", () => {
    expect(deriveOwnerDeepWritingSignals([sample("LOL!")])).toEqual([])
    const signals = deriveOwnerDeepWritingSignals(Array.from({ length: 20 }, () => sample("LOL, that was funny.")))
    expect(signals.find((x) => x.id === "self-marked-humor")?.count).toBe(20)
    expect(signals.find((x) => x.id === "possible-ironic-contrast")).toBeUndefined()
    expect(signals.find((x) => x.id === "contrast-turn")).toBeUndefined()
  })

  it("treats rhetorical forms, slang, stories, reported speech and possible contrast as distinct indicators", () => {
    const corpus: WritingSample[] = [
      ...Array.from({ length: 10 }, () => sample("You really think that is the plan? Nah, I'm gonna try again.", "post")),
      ...Array.from({ length: 10 }, () => sample('First I stopped there, then we went home and he said "See you tomorrow".', "comment")),
      ...Array.from({ length: 10 }, () => sample("Yeah right, what could go wrong? Plot twist, but nobody knew that.", "post")),
    ]
    const signals = deriveOwnerDeepWritingSignals(corpus)
    const get = (id: string) => signals.find((s) => s.id === id)
    expect(get("rhetorical-form")?.count).toBe(20)
    expect(get("casual-diction")?.count).toBe(10)
    expect(get("narrative-sequence")?.comments).toBe(10)
    expect(get("dialogue-framing")?.comments).toBe(10)
    expect(get("possible-ironic-contrast")?.posts).toBe(10)
    expect(get("contrast-turn")?.posts).toBe(10)
    expect(get("self-marked-humor")?.count).toBe(10)
    expect(signals.every((s) => s.reliability === "surface-pattern-only")).toBe(true)
  })

  it("never returns snippets, source filenames, dates, named entities or user-derived words", () => {
    const corpus = Array.from({ length: 18 }, (_, i) =>
      sample("Never include PRIVATE-FAKE-NAME-702 in the output. Yeah right, as if.", i % 2 ? "comment" : "post"))
    const signals = deriveOwnerDeepWritingSignals(corpus)
    expect(signals.find((x) => x.id === "possible-ironic-contrast")).toMatchObject({
      count: 18, posts: 9, comments: 9, denominator: 18, percent: 100,
    })
    const json = JSON.stringify(signals)
    expect(json).not.toMatch(/PRIVATE-FAKE|your_posts|2013-05-01|exampleIndexes|embedding|excerpt|"text"\s*:|"source"\s*:/i)
    expect(json).not.toMatch(/religion|diagnosis|ethnicity|political leaning/i)
  })

  it("bounds work to 2500 entries even when a caller accidentally passes more", () => {
    const corpus = [
      ...Array.from({ length: 2500 }, () => sample("A neutral sentence with neither contrast nor a marked joke.")),
      ...Array.from({ length: 150 }, () => sample("Yeah right, as if!")),
    ]
    expect(deriveOwnerDeepWritingSignals(corpus)
      .find((x) => x.id === "possible-ironic-contrast")).toBeUndefined()
  })

  it("never presents wordplay as verified or treats standard contrast words as confirmed sarcasm", () => {
    const corpus = Array.from({ length: 15 }, () => sample("I tried this but the car would not start today."))
    const signals = deriveOwnerDeepWritingSignals(corpus)
    expect(signals.find((x) => x.id === "contrast-turn")?.count).toBe(15)
    expect(signals.find((x) => x.id === "possible-ironic-contrast")).toBeUndefined()
    expect(signals.some((x) => /detected joke|identified sarcasm|personality|wordplay/i.test(x.label))).toBe(false)
  })
})
