import { describe, expect, it } from "vitest"
import { checkInteractionQualityProductionHealth } from "./interaction-quality-production-health"

describe("JHADINA-INTERACTION-QUALITY.FINAL production health", () => {
  it("reports READY only when the full deterministic quality matrix and model guidance are present", () => {
    const health = checkInteractionQualityProductionHealth()

    expect(health.contractVersion).toBe("JHADINA-INTERACTION-QUALITY.FINAL")
    expect(health.status).toBe("READY")
    expect(health.modelGuidanceRules).toBeGreaterThanOrEqual(15)
    expect(health.certification.status).toBe("READY")
    expect(health.certification.gates).toHaveLength(13)
    expect(health.certification.gates.every((gate) => gate.ready)).toBe(true)
  })
})
