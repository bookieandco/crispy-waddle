import { describe, expect, it } from "vitest"
import { checkLiveContextProductionHealth } from "./live-context-production-health"

describe("JHADINA-LIVE-CONTEXT.FINAL production health",()=>{
  it("reports READY only when the canonical bounded continuity contract is ready",()=>{
    const health=checkLiveContextProductionHealth()
    expect(health.contractVersion).toBe("JHADINA-LIVE-CONTEXT.FINAL")
    expect(health.status).toBe("READY")
    expect(Object.values(health.certification.checks).every(Boolean)).toBe(true)
    expect(health.limits.retainedDistinctScreenFrames).toBe(2)
    expect(health.limits.maxRecentTurns).toBe(8)
  })
})
