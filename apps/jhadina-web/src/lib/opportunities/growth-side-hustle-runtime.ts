import {
  buildGrowthSideHustleOpportunity,
  type GrowthSideHustleFactoryInput,
  type GrowthSideHustleFactoryResult,
} from '@jhadina/growth-core'
import type { Opportunity } from '@jhadina/opportunity-core'
import type { StoredCanonicalOpportunity } from './canonical'
import { createSupabaseOpportunityRepository } from './supabase-opportunity-repository'

export type GrowthSideHustleOpportunityRepository = {
  upsert: (
    userId: string,
    opportunity: Opportunity,
  ) => Promise<StoredCanonicalOpportunity>
}

export type PersistedGrowthSideHustleOpportunity = GrowthSideHustleFactoryResult & {
  stored: StoredCanonicalOpportunity
}

/**
 * Server-side Growth -> Opportunity persistence boundary.
 *
 * The candidate is persisted into the existing canonical Opportunity repository.
 * The returned experiment proposal still requires review; this runtime does not
 * create/start an experiment or grant any execution authority.
 */
export async function ingestGrowthSideHustleOpportunity(
  userId: string,
  input: GrowthSideHustleFactoryInput,
  repository: GrowthSideHustleOpportunityRepository = createSupabaseOpportunityRepository(),
): Promise<PersistedGrowthSideHustleOpportunity> {
  if (!userId.trim()) throw new Error('userId is required')

  const factory = buildGrowthSideHustleOpportunity(input)
  const stored = await repository.upsert(userId, factory.opportunity)

  return {
    ...factory,
    stored,
  }
}
