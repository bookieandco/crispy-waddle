import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DeepPeriodCards } from "./deep-period-cards"
import { summarizeOwnerDeepWritingPeriods } from "@/lib/personality/facebook-owner-deep-periods"
import type { WritingSample } from "@/lib/personality/facebook-owner-import"

const fake = (year: number, text: string): WritingSample => ({
  kind: "post", text, source: "PRIVATE-DUMMY-FILENAME-NEVER-PRINT.json",
  at: new Date(Date.UTC(year, 0, 1)).toISOString(),
})

describe("FB-RELATE.DEEP.07 read-only mobile dashboard", () => {
  it("renders only fixed labels and numeric aggregates for sufficiently represented periods", () => {
    const samples = [
      ...Array.from({ length: 40 }, () => fake(2011, "Yeah right, as if!")),
      ...Array.from({ length: 4 }, () => fake(2016, "LOL PRIVATE-DUMMY-TEXT-MARKER")),
    ]
    const html = renderToStaticMarkup(createElement(DeepPeriodCards, {
      periods: summarizeOwnerDeepWritingPeriods(samples),
    }))
    expect(html).toContain("Sample period 2010–2013")
    expect(html).toContain("Sample period 2014–2017")
    expect(html).toContain("Possible ironic-contrast wording: 40/40 (100%)")
    expect(html).toContain("Too few sampled entries to report wording proportions")
    expect(html).not.toMatch(/PRIVATE-DUMMY-TEXT|PRIVATE-DUMMY-FILENAME|2016-01-01|sample source/i)
  })

  it("does not render interactive approval controls or any server upload surface", () => {
    const html = renderToStaticMarkup(createElement(DeepPeriodCards, {
      periods: summarizeOwnerDeepWritingPeriods(Array.from({ length: 40 }, () => fake(2025, "A plain synthetic sample."))),
    }))
    expect(html).not.toMatch(/<button|<form|action=|password|Propose memory|Approve/)
    expect(html).toContain("Sample period 2022–2026")
  })

  it("handles a zero-record sample without displaying false inference", () => {
    expect(renderToStaticMarkup(createElement(DeepPeriodCards, { periods: summarizeOwnerDeepWritingPeriods([]) })))
      .toContain("No dated writing in the bounded sample")
  })
})
