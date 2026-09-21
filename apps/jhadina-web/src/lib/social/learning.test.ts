import { describe, expect, it } from "vitest"
import type { SocialPerformanceObservation } from "@jhadina/social-core"
import { buildSocialLearningProjection } from "./learning"

describe("social learning projection", () => {
  it("projects performance into Growth attribution without granting imported data perfect confidence", () => {
    const observation: SocialPerformanceObservation = {
      id: "observation-1",
      userId: "user-1",
      kind: "performance",
      source: "user-import",
      platform: "youtube",
      accountId: "account-1",
      contentId: "video-1",
      observedAt: "2026-09-20T12:00:00.000Z",
      evidence: ["analytics export"],
      metrics: { impressions: 1000, clicks: 40, purchases: 2 },
      attributes: { confidence: 0.5 },
    }

    const projection = buildSocialLearningProjection(observation)
    expect(projection).not.toBeNull()
    expect(projection?.creativeSignal.contentId).toBe("video-1")
    expect(projection?.attributionEvents).toHaveLength(3)
    expect(projection?.attributionEvents.every((event) => event.confidence === 0.5)).toBe(true)
  })
})
