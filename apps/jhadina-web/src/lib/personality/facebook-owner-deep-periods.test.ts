import { describe, expect, it } from "vitest"
import { summarizeOwnerDeepWritingPeriods, periodForOwnerWritingDate } from "./facebook-owner-deep-periods"
import type { WritingSample } from "./facebook-owner-import"

const sample = (year: number | null, text: string, kind: "post" | "comment" = "post"): WritingSample => ({
  source: "your_posts_123.json", kind, text,
  ...(year === null ? {} : { at: new Date(Date.UTC(year, 2, 12)).toISOString() }),
})

describe("FB-RELATE.DEEP.05 fixed-period read-only review", () => {
  it("uses fixed year buckets with no exact dates or source paths in the output", () => {
    const items = [
      ...Array.from({ length: 35 }, () => sample(2011, "Well first we tried it, then somebody said we should go home.", "post")),
      ...Array.from({ length: 14 }, () => sample(2016, "Yeah right, as if this could happen.", "comment")),
      ...Array.from({ length: 45 }, () => sample(2019, "LOL, that is a funny joke.", "comment")),
      ...Array.from({ length: 40 }, () => sample(2024, "Do you think that is possible? Nah.", "post")),
      ...Array.from({ length: 5 }, () => sample(null, "I cannot identify the posting year.", "post")),
    ]
    const periods = summarizeOwnerDeepWritingPeriods(items)
    expect(periods).toHaveLength(5)
    expect(periods.map((x) => x.entries)).toEqual([35, 14, 45, 40, 5])
    expect(periods[1]).toMatchObject({
      period: "2014–2017", status: "insufficient-sampled-writing", indicators: [],
    })
    expect(periods[2].indicators.find((x) => x.id === "self-marked-humor")?.count).toBe(45)
    expect(periods[3].indicators.find((x) => x.id === "casual-diction")?.count).toBe(40)
    expect(JSON.stringify(periods)).not.toMatch(/your_posts|2024-03-12|first we tried|funny joke|rawText|sourcePath/i)
  })

  it("does not classify invalid timestamps as valid sampled periods", () => {
    expect(periodForOwnerWritingDate("2026")).toBe("Other/undated")
    expect(periodForOwnerWritingDate("2029-10-12T00:00:00Z")).toBe("Other/undated")
    expect(periodForOwnerWritingDate("2010-01-01T00:00:00Z")).toBe("2010–2013")
    expect(periodForOwnerWritingDate("2026-10-01T00:00:00Z")).toBe("2022–2026")
    expect(periodForOwnerWritingDate()).toBe("Other/undated")
  })

  it("reports sample-rate denominators only and never extrapolates behavior changes", () => {
    const items = [
      ...Array.from({ length: 70 }, () => sample(2012, "LOL!")),
      ...Array.from({ length: 70 }, () => sample(2024, "A synthetic neutral work summary.")),
    ]
    const periods = summarizeOwnerDeepWritingPeriods(items)
    const earlier = periods.find((x) => x.period === "2010–2013")!
    expect(earlier.indicators.find((x) => x.id === "self-marked-humor")?.denominator).toBe(70)
    expect(earlier.indicators.find((x) => x.id === "self-marked-humor")?.count).toBe(70)
    expect(periods.every((x) => !("personalityChange" in x) && !("trend" in x))).toBe(true)
  })

  it("bounds the panel at the same 2500 retained samples", () => {
    const items = [
      ...Array.from({ length: 2500 }, () => sample(2012, "A synthetic simple statement.")),
      ...Array.from({ length: 50 }, () => sample(2024, "LOL!!!")),
    ]
    const periods = summarizeOwnerDeepWritingPeriods(items)
    expect(periods.reduce((total, item) => total + item.entries, 0)).toBe(2500)
    expect(periods.find((x) => x.period === "2022–2026")?.entries).toBe(0)
  })
})
