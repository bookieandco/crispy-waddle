import type { Opportunity } from "@/../../../packages/growth-core/src/opportunity/domain/opportunity"
import type { MoneyCommandCenterSnapshot } from "@/../../../packages/growth-core/src/opportunity/command-center/money-command-center"
import { projectMoneyCommandCenter } from "@/../../../packages/growth-core/src/opportunity/command-center/money-command-center"
import { listOpportunities } from "./engine"
import { legacyToCanonicalOpportunity } from "./canonicalAdapter"

export function getMoneyCommandCenterSnapshot(userId: string): MoneyCommandCenterSnapshot {
  const canonical: Opportunity[] = listOpportunities(userId).map(legacyToCanonicalOpportunity)
  const entries = canonical
    .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0) || b.updatedAt.localeCompare(a.updatedAt))
    .map((opportunity, index) => ({ opportunity, rank: index + 1 }))

  return projectMoneyCommandCenter(entries)
}
