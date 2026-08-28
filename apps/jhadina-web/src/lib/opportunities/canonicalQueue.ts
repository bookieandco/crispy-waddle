import type { Opportunity } from "@jhadina/growth-core/opportunity/domain/opportunity"
import { CanonicalOpportunityQueue } from "@jhadina/growth-core/opportunity/queue/canonical-opportunity-queue"
import type { MoneyCommandCenterSnapshot } from "@jhadina/growth-core/opportunity/command-center/money-command-center"
import { projectMoneyCommandCenter } from "@jhadina/growth-core/opportunity/command-center/money-command-center"
import { listOpportunities } from "./engine"
import { legacyToCanonicalOpportunity } from "./canonicalAdapter"

export function getMoneyCommandCenterSnapshot(userId: string): MoneyCommandCenterSnapshot {
  const canonical: Opportunity[] = listOpportunities(userId).map(legacyToCanonicalOpportunity)
  const queue = new CanonicalOpportunityQueue()
  return projectMoneyCommandCenter(queue.ingest(canonical))
}
