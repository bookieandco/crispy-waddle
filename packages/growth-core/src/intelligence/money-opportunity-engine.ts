export type MoneyOpportunityChannel =
  | "affiliate"
  | "commerce"
  | "service"
  | "content"
  | "digital_product"
  | "software"
  | "government"
  | "subcontract"
  | "real_estate"
  | "recovery"

export interface MoneyOpportunity {
  id: string
  channel: MoneyOpportunityChannel
  title: string
  source: string
  sourceUrl: string
  estimatedRevenue: number
  estimatedCost: number
  estimatedHours: number
  fitScore: number
  probability: number
  riskScore: number
  capitalRequired: number
  deadline?: string
  evidence: string[]
  requiredCapabilities: string[]
  approvalRequired: boolean
}

export interface MoneyOpportunityScore {
  id: string
  rank: number
  score: number
  expectedProfit: number
  profitPerHour: number
  rationale: string
  blocked: boolean
}

/** Decision-support ranking only. It never executes purchases, bids, applications, or outreach. */
export function rankMoneyOpportunities(items: readonly MoneyOpportunity[]): MoneyOpportunityScore[] {
  return items
    .map((item) => {
      const expectedProfit = Math.max(item.estimatedRevenue - item.estimatedCost, 0) * clamp(item.probability, 0, 1)
      const profitPerHour = expectedProfit / Math.max(item.estimatedHours, 1)
      const fit = clamp(item.fitScore / 100, 0, 1)
      const risk = clamp(item.riskScore / 100, 0, 1)
      const capitalPenalty = Math.min(item.capitalRequired / 10_000, 1)
      const blocked = item.approvalRequired && item.requiredCapabilities.includes("approval_missing")
      const score = blocked
        ? 0
        : (expectedProfit * 0.45 + profitPerHour * 0.25 + fit * 200) * (1 - risk * 0.15) * (1 - capitalPenalty * 0.1)

      return {
        id: item.id,
        rank: 0,
        score,
        expectedProfit,
        profitPerHour,
        rationale: buildRationale(item, expectedProfit, profitPerHour, blocked),
        blocked,
      }
    })
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function buildRationale(item: MoneyOpportunity, expectedProfit: number, profitPerHour: number, blocked: boolean): string {
  if (blocked) return "Blocked until the required human approval/capability is available."
  return `${item.channel} opportunity with estimated expected profit $${Math.round(expectedProfit).toLocaleString()} and $${Math.round(profitPerHour).toLocaleString()}/hour expected value.`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
