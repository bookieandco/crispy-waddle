import { describe, expect, it } from "vitest"
import { buildVisualResponse, parseVisualResponse } from "./visual-response"

const answer = "1. Gather the ingredients.\n2. Cook the pasta for ten minutes.\n3. Add fresh spinach and lemon."
const proposal = (recommendation = answer) => ({
  disposition: "PROCEED" as const,
  recommendation,
  evidence: [] as { id: string; source: string; summary: string }[],
})

describe("JLLM interactive visual response boundary", () => {
  it("creates local-only checklist controls from the governed answer", () => {
    const view = buildVisualResponse({ activeTask: "Make an interactive recipe checklist", proposal: proposal(), verified: true })
    expect(view?.kind).toBe("checklist")
    expect(view?.authority).toBe("PRESENTATION_ONLY")
    expect(view?.items.map(item => item.label)).toEqual([
      "Gather the ingredients.",
      "Cook the pasta for ten minutes.",
      "Add fresh spinach and lemon.",
    ])
    expect(view && parseVisualResponse(view)).toEqual(view)
  })

  it("derives stepper and diagram only for explicit visual intent", () => {
    expect(buildVisualResponse({ activeTask: "Explain this visually step by step", proposal: proposal(), verified: true })?.kind).toBe("stepper")
    expect(buildVisualResponse({ activeTask: "Show an architecture diagram", proposal: proposal(), verified: true })?.kind).toBe("diagram")
    expect(buildVisualResponse({ activeTask: "Summarize this", proposal: proposal(), verified: true })).toBeNull()
  })

  it("never renders unverified, deferred, or declined decisions as authoritative visuals", () => {
    expect(buildVisualResponse({ activeTask: "chart", proposal: proposal(), verified: false })).toBeNull()
    expect(buildVisualResponse({ activeTask: "chart", proposal: { ...proposal(), disposition: "DECLINE" }, verified: true })).toBeNull()
    expect(buildVisualResponse({ activeTask: "chart", proposal: { ...proposal(), disposition: "ASK" }, verified: true })).toBeNull()
  })

  it("charts only numbers explicitly written with compatible units", () => {
    const numbers = proposal("North: 40%\nSouth: 60%\nEast: 20%")
    const bars = buildVisualResponse({ activeTask: "Visualize this as a chart", proposal: numbers, verified: true })
    expect(bars?.kind).toBe("bars")
    expect(bars?.items.map(item => item.value)).toEqual([40, 60, 20])
    const mixed = buildVisualResponse({ activeTask: "Make a chart", proposal: proposal("North: 40%\nSouth: $60\nEast: 20%"), verified: true })
    expect(mixed?.kind).not.toBe("bars")
    expect(mixed?.note).toContain("No comparable numeric series")
  })

  it("gallery does not fabricate photographs and requires existing evidence sources", () => {
    const sources = { ...proposal(), evidence: [
      { id: "one", source: "Source A", summary: "First observation" },
      { id: "two", source: "Source B", summary: "Second observation" },
    ] }
    const view = buildVisualResponse({ activeTask: "Show a photo gallery", proposal: sources, verified: true })
    expect(view?.kind).toBe("gallery")
    expect(view?.items).toHaveLength(2)
    expect(view?.note).toContain("No photographs")
    expect(view?.items.every(item => !("imageUrl" in item))).toBe(true)
  })

  it("rejects unsupported UI types, duplicate ids, mismatched bars, and executable fields", () => {
    const safe = buildVisualResponse({ activeTask: "visual checklist", proposal: proposal(), verified: true })!
    expect(parseVisualResponse({ ...safe, kind: "iframe" })).toBeNull()
    expect(parseVisualResponse({ ...safe, items: [safe.items[0], safe.items[0]] })).toBeNull()
    expect(parseVisualResponse({ ...safe, authority: "EXECUTE" })).toBeNull()
    const parsed = parseVisualResponse({ ...safe, onClick: "runCommand()", items: safe.items.map(item => ({ ...item, script: "alert(1)" })) })
    expect(parsed).toEqual(safe)
    expect(parsed && "onClick" in parsed).toBe(false)
    expect(parsed?.items.some(item => "script" in item)).toBe(false)
    expect(parseVisualResponse({ ...safe, kind: "bars" })).toBeNull()
  })

  it("bounds the number and length of projected items", () => {
    const long = Array.from({ length: 30 }, (_, index) => String(index + 1) + ". " + "x".repeat(230)).join("\n")
    const view = buildVisualResponse({ activeTask: "interactive steps", proposal: proposal(long), verified: true })
    expect(view?.items).toHaveLength(8)
    expect(view?.items.every(item => item.label.length <= 160)).toBe(true)
  })
})
