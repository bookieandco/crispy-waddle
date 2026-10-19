import { describe, expect, it } from "vitest"
import { previewFacebookExports, formatFacebookAuditSummary, summarizeFacebookYears } from "./facebook-owner-import"

/** Synthetic records only; counts mirror a previously verified aggregate manifest.
 * No Facebook data, original phrases, paths, credentials or media are test fixtures. */
const observedByYear: readonly (readonly [number, number, number])[] = [
  [2010, 41, 105], [2011, 829, 591], [2012, 793, 566],
  [2013, 1879, 962], [2014, 1189, 396], [2015, 1017, 375],
  [2016, 875, 505], [2017, 359, 349], [2018, 343, 466],
  [2019, 385, 467], [2020, 408, 498], [2021, 273, 283],
  [2022, 57, 53], [2023, 83, 416], [2024, 39, 205],
  [2025, 664, 887], [2026, 87, 5],
]

const file = (name: string, entries: unknown[]) => ({
  name, blob: new Blob([JSON.stringify(entries)]),
})

describe("FB-RELATE.DEEP.01-.02: historical selected JSON source invariants", () => {
  it("reconciles a 17-year synthetic manifest to 16450 observed vs 2500 sampled without account-completeness claims", async () => {
    const posts: unknown[] = []
    const comments: unknown[] = []
    for (const [year, postCount, commentCount] of observedByYear) {
      const timestamp = Date.UTC(year, 0, 1) / 1000
      for (let i = 0; i < postCount; i++) posts.push({
        timestamp, data: [{ post: "Invented test post " + year + " number " + i }],
      })
      for (let i = 0; i < commentCount; i++) comments.push({
        timestamp, data: [{ comment: { comment: "Invented test comment " + year + " number " + i } }],
      })
    }
    expect(posts).toHaveLength(9321)
    expect(comments).toHaveLength(7129)
    const input = [
      file("your_posts__check_ins__photos_and_videos_1.json", posts.slice(0, 7330)),
      file("your_posts__check_ins__photos_and_videos_2.json", posts.slice(7330)),
      file("comments.json", comments),
    ]
    const result = await previewFacebookExports(input)
    const report = JSON.parse(formatFacebookAuditSummary(result))
    expect(result.filesRead).toBe(3)
    expect(result.filesSkipped).toBe(0)
    expect(result.observedWritingEntries).toBe(16450)
    expect(report.sampledWritingTotal).toBe(2500)
    expect(report.observedYears).toHaveLength(17)
    expect(report.observedYears.reduce((sum: number, y: { posts: number },) => sum + y.posts, 0)).toBe(9321)
    expect(report.observedYears.reduce((sum: number, y: { comments: number },) => sum + y.comments, 0)).toBe(7129)
    expect(report.completeHistoryVerified).toBe(false)
    expect(report.partialPreview).toBe(true)
    expect(report.sampleLimitReached).toBe(true)
    expect(summarizeFacebookYears(result.samples).map((x) => x.year).sort()).toEqual(
      observedByYear.map((x) => String(x[0])).sort())
    expect(JSON.stringify(report)).not.toMatch(/Invented test post|Invented test comment|your_posts|comments\.json/)
  })

  it("preserves an identical numeric census and preview for any order of selected files", async () => {
    const frequent = Array.from({ length: 3000 }, (_, i) => ({
      timestamp: Date.UTC(2013, 0, 1) / 1000,
      data: [{ post: "Synthetic frequent long message number " + i }],
    }))
    const rare = Array.from({ length: 5 }, (_, i) => ({
      timestamp: Date.UTC(2022, 0, 1) / 1000,
      data: [{ post: "Synthetic rare-year message " + i }],
    }))
    const comments = Array.from({ length: 11 }, (_, i) => ({
      timestamp: Date.UTC(2026, 0, 1) / 1000,
      data: [{ comment: { comment: "Synthetic 2026 owner comment " + i } }],
    }))
    const files = [
      file("your_posts_2013.json", frequent),
      file("your_posts_2022.json", rare),
      file("comments.json", comments),
    ]
    const first = await previewFacebookExports(files)
    const reversed = await previewFacebookExports([...files].reverse())
    expect(first.samples).toEqual(reversed.samples)
    expect(first.observedYears).toEqual(reversed.observedYears)
    expect(first.observedWritingEntries).toBe(3016)
    const rows = summarizeFacebookYears(first.samples)
    expect(rows.find((r) => r.year === "2022")?.posts).toBe(5)
    expect(rows.find((r) => r.year === "2026")?.comments).toBe(11)
  })

  it("counts repeated strings in the observed census but avoids reweighting the retained sample", async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      timestamp: Date.UTC(2014, 0, i + 1) / 1000,
      data: [{ post: "Exactly the same synthetic caption" }],
    }))
    const result = await previewFacebookExports([file("your_posts_2014.json", entries)])
    expect(result.observedWritingEntries).toBe(12)
    expect(result.samples).toHaveLength(1)
    expect(result.sampleLimitReached).toBe(false)
    expect(result.truncated).toBe(false)
  })
})
