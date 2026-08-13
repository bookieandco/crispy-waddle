import { describe, it, expect } from "vitest"
import { advancePodJob, failPodJob, retryPodJob, type PodJob } from "../lib/pod/workflow"
import { evaluateImageQuality, type PrintProfile } from "../lib/pod/quality-gate"
import { canFulfill, type PodEvent } from "../lib/pod/events"
import { buildAutomationDispatch, canDispatchToProvider } from "../lib/pod/automation"
import { evaluateArtwork } from "../lib/pod/image-qa"

function job(overrides: Partial<PodJob> = {}): PodJob {
  return {
    id: "job-1",
    creationId: "creation-1",
    stage: "photo_received",
    status: "queued",
    attempts: 0,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("pod workflow", () => {
  it("advances through every stage in order, ending complete", () => {
    let current = job()
    const seen = [current.stage]
    for (let i = 0; i < 15 && current.stage !== "complete"; i += 1) {
      current = advancePodJob(current)
      seen.push(current.stage)
    }
    expect(seen[seen.length - 1]).toBe("complete")
    // customer_approval must precede any provider/production stage
    expect(seen.indexOf("customer_approval")).toBeLessThan(seen.indexOf("provider_upload"))
    expect(seen.indexOf("provider_upload")).toBeLessThan(seen.indexOf("order_created"))
  })

  it("stops advancing once complete", () => {
    const done = job({ stage: "complete" })
    expect(advancePodJob(done).stage).toBe("complete")
  })

  it("records failure with an incremented attempt count", () => {
    const failed = failPodJob(job({ attempts: 2 }), "boom")
    expect(failed.status).toBe("failed")
    expect(failed.attempts).toBe(3)
    expect(failed.lastError).toBe("boom")
  })

  it("resets a failed job to queued on retry", () => {
    const retried = retryPodJob(failPodJob(job(), "boom"))
    expect(retried.status).toBe("queued")
  })
})

describe("pod quality gate", () => {
  const profile: PrintProfile = { name: "shirt-front", printWidthInches: 12, printHeightInches: 16, minDpi: 150, safeMarginInches: 0.25 }

  it("passes a high-resolution, correctly formatted image", () => {
    const report = evaluateImageQuality({ width: 1800, height: 2400, mimeType: "image/png", hasPetSubject: true, subjectCoverage: 1 }, profile)
    expect(report.productionReady).toBe(true)
    expect(report.status).toBe("pass")
  })

  it("fails a low-resolution image", () => {
    const report = evaluateImageQuality({ width: 200, height: 200, mimeType: "image/png" }, profile)
    expect(report.productionReady).toBe(false)
  })

  it("scores zero on subject visibility when no pet is detected", () => {
    const report = evaluateImageQuality({ width: 1800, height: 2400, mimeType: "image/png", hasPetSubject: false }, profile)
    const subjectCheck = report.checks.find((c) => c.id === "subject")
    expect(subjectCheck?.score).toBe(0)
  })
})

describe("pod events", () => {
  it("only customer.approved authorizes fulfillment", () => {
    const approved: PodEvent = { type: "customer.approved", creationId: "c1" }
    const qa: PodEvent = { type: "qa.completed", creationId: "c1", productionReady: true, score: 95 }
    expect(canFulfill(approved)).toBe(true)
    expect(canFulfill(qa)).toBe(false)
  })
})

describe("pod automation", () => {
  it("builds an internal-target dispatch and confirms it's dispatchable", () => {
    const event: PodEvent = { type: "creation.created", creationId: "c1" }
    const dispatch = buildAutomationDispatch(event)
    expect(dispatch.target).toBe("internal")
    expect(canDispatchToProvider(dispatch)).toBe(true)
  })
})

describe("pod artwork QA", () => {
  it("rejects artwork below the minimum production dimension", () => {
    const result = evaluateArtwork({ width: 800, height: 800, mimeType: "image/png" })
    expect(result.productionReady).toBe(false)
    expect(result.reasons.some((r) => r.includes("1600px"))).toBe(true)
  })

  it("accepts artwork meeting every production requirement", () => {
    const result = evaluateArtwork({ width: 2000, height: 2000, mimeType: "image/png", fileSizeBytes: 5 * 1024 * 1024 })
    expect(result.productionReady).toBe(true)
    expect(result.score).toBe(100)
  })
})
