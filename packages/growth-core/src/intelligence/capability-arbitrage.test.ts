import { describe, expect, it } from "vitest"
import { planCapabilityArbitrage } from "./capability-arbitrage"

describe("planCapabilityArbitrage", () => {
  it("selects direct delivery when capabilities are owned", () => {
    const plan = planCapabilityArbitrage({
      opportunityId: "gov-1",
      estimatedRevenue: 100000,
      estimatedDirectCost: 40000,
      estimatedHours: 500,
      requirements: [
        { name: "project management", status: "owned" },
        { name: "software delivery", status: "owned" },
      ],
    })

    expect(plan.path).toBe("direct")
    expect(plan.estimatedGrossProfit).toBe(60000)
    expect(plan.blocked).toBe(false)
  })

  it("builds a partner-assembled path when a priced capability is missing", () => {
    const plan = planCapabilityArbitrage({
      opportunityId: "gov-2",
      estimatedRevenue: 250000,
      estimatedDirectCost: 70000,
      estimatedHours: 800,
      requirements: [
        { name: "program management", status: "owned" },
        { name: "field installation", status: "missing", estimatedCost: 90000 },
      ],
    })

    expect(plan.path).toBe("partner_assembled")
    expect(plan.missingCapabilities).toEqual(["field installation"])
    expect(plan.estimatedGrossProfit).toBe(90000)
  })

  it("blocks when required evidence is unknown", () => {
    const plan = planCapabilityArbitrage({
      opportunityId: "gov-3",
      estimatedRevenue: 100000,
      estimatedDirectCost: 50000,
      estimatedHours: 400,
      approvalRequired: true,
      requirements: [{ name: "security clearance", status: "unknown" }],
    })

    expect(plan.path).toBe("blocked")
    expect(plan.blocked).toBe(true)
  })
})
