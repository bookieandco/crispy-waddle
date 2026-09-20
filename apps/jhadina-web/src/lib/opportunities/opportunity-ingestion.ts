import type {
  GrowthOpportunity,
  Opportunity,
  OpportunityMinerCandidate,
} from '@jhadina/growth-core'
import { adaptGrowthOpportunities, adaptOpportunityMinerCandidates } from '@jhadina/growth-core'
import { CanonicalOpportunityQueue } from './canonical-queue.js'
import { adaptOverageOpportunities, type OverageOpportunityCandidate } from './overage-canonical-adapter.js'

export type OpportunityIngestionBatch = {
  legacy?: Parameters<CanonicalOpportunityQueue['ingestLegacy']>[0]
  overage?: readonly OverageOpportunityCandidate[]
  growth?: readonly GrowthOpportunity[]
  miner?: readonly OpportunityMinerCandidate[]
}

/**
 * Single application-level convergence point for existing opportunity paths.
 * Source adapters remain responsible for their own domain validation; this
 * layer only normalizes and deduplicates canonical Opportunities.
 */
export function ingestOpportunitySources(userId: string, batch: OpportunityIngestionBatch): Opportunity[] {
  const queue = new CanonicalOpportunityQueue()
  if (batch.legacy?.length) queue.ingestLegacy(batch.legacy)
  if (batch.overage?.length) queue.ingest(adaptOverageOpportunities(batch.overage, userId))
  if (batch.growth?.length) queue.ingest(adaptGrowthOpportunities(batch.growth, userId))
  if (batch.miner?.length) queue.ingest(adaptOpportunityMinerCandidates(batch.miner, userId))
  return queue.list()
}
