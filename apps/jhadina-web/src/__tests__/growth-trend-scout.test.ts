import { describe, it, expect, vi } from "vitest"
import { createInspirationIdea, summarizeTrend, type TrendObservation } from "../lib/growth/trendScout"
import { scoutTrends, proposalFromScout, connectorFromFetcher } from "../lib/growth/trendScoutWorker"
import { createSchedule, dueForPublishing, cancelSchedule } from "../lib/growth/scheduler"

function observation(overrides: Partial<TrendObservation> = {}): TrendObservation {
  return {
    source: "web",
    title: "Example trend",
    observedAt: new Date().toISOString(),
    signals: { hook: "cold open", format: "vlog" },
    ...overrides,
  }
}

describe("trendScout", () => {
  it("requires at least one observation to create an inspiration idea", () => {
    expect(() => createInspirationIdea([], "title", "rationale")).toThrow()
  })

  it("creates a pending-approval idea marked as inspired, not copied", () => {
    const idea = createInspirationIdea([observation()], "Cold open experiment", "Recurring pattern")
    expect(idea.status).toBe("PENDING_APPROVAL")
    expect(idea.originalityRule).toBe("INSPIRED_NOT_COPIED")
    expect(idea.sourceObservations).toHaveLength(1)
  })

  it("summarizes and ranks repeated signal patterns", () => {
    const summary = summarizeTrend([
      observation({ signals: { hook: "cold open" } }),
      observation({ signals: { hook: "cold open" } }),
      observation({ signals: { hook: "voiceover" } }),
    ])
    expect(summary[0]).toEqual({ pattern: "cold open", count: 2 })
  })
})

describe("trendScoutWorker", () => {
  it("collects observations from every connector for every query", async () => {
    const connector = connectorFromFetcher("web", async (query) => [observation({ title: query })])
    const result = await scoutTrends([connector], ["query-a", "query-b"])
    expect(result.observations).toHaveLength(2)
    expect(result.observations.map((o) => o.title)).toEqual(["query-a", "query-b"])
  })

  it("returns null for an empty observation set instead of a bogus proposal", () => {
    expect(proposalFromScout([])).toBeNull()
  })

  it("builds a proposal instructing an original, non-reproduced experiment", () => {
    const proposal = proposalFromScout([observation({ signals: { hook: "cold open" } })])
    expect(proposal?.originalityRule).toBe("INSPIRED_NOT_COPIED")
    expect(proposal?.rationale).toContain("do not reproduce source content")
  })
})

describe("scheduler", () => {
  it("rejects a schedule with no networks", () => {
    expect(() =>
      createSchedule({ contentId: "c1", networks: [], publishAt: new Date().toISOString(), timezone: "UTC", approvalRequired: true }),
    ).toThrow()
  })

  it("rejects an invalid publishAt timestamp", () => {
    expect(() =>
      createSchedule({ contentId: "c1", networks: ["instagram"], publishAt: "not-a-date", timezone: "UTC", approvalRequired: true }),
    ).toThrow()
  })

  it("creates a scheduled post and finds it due once its time has passed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    const post = createSchedule({
      contentId: "c1",
      networks: ["instagram", "tiktok"],
      publishAt: "2026-01-01T00:00:00Z",
      timezone: "UTC",
      approvalRequired: false,
    })
    expect(post.status).toBe("SCHEDULED")
    expect(dueForPublishing([post], new Date("2026-01-01T00:00:01Z"))).toEqual([post])
    expect(dueForPublishing([post], new Date("2025-12-31T23:59:59Z"))).toEqual([])
    vi.useRealTimers()
  })

  it("only cancels posts that are still scheduled", () => {
    const post = createSchedule({ contentId: "c1", networks: ["x"], publishAt: new Date().toISOString(), timezone: "UTC", approvalRequired: false })
    const cancelled = cancelSchedule(post)
    expect(cancelled.status).toBe("CANCELLED")
    expect(() => cancelSchedule(cancelled)).toThrow()
  })
})
