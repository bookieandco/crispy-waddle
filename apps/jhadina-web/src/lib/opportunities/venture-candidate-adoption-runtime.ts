import {
  ventureCandidateToOpportunity,
  type VentureDiscoveryCandidate,
} from '@jhadina/opportunity-core'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  VentureRuntimeRepository,
  type VentureDiscoveryPolicy,
} from './venture-runtime-repository'

export type VentureAdoptionRepository = Pick<
  VentureRuntimeRepository,
  'listAutoAdoptPolicies' | 'listCandidates' | 'listCandidateAdoptions'
>

type AdoptionRpcResult = {
  adopted?: boolean
  alreadyAdopted?: boolean
  candidateId?: string
  opportunityId?: string
}

export async function runVentureCandidateAutoAdoption(
  client: SupabaseClient,
  input: {
    policyLimit?: number
    repository?: VentureAdoptionRepository
    adopt?: (
      ownerUserId: string,
      candidate: VentureDiscoveryCandidate,
      opportunity: ReturnType<typeof ventureCandidateToOpportunity>,
    ) => Promise<AdoptionRpcResult>
  } = {},
) {
  const repository = input.repository ?? new VentureRuntimeRepository(client)
  const policies = await repository.listAutoAdoptPolicies(input.policyLimit ?? 100)
  const results: Array<{
    ownerUserId: string
    considered: number
    adopted: number
    skippedExisting: number
    errors: string[]
  }> = []

  const adopt = input.adopt ?? (async (ownerUserId, candidate, opportunity) => {
    const { data, error } = await client.rpc('jhadina_venture_candidate_adopt', {
      p_owner_user_id: ownerUserId,
      p_candidate_id: candidate.id,
      p_opportunity: opportunity,
    })
    if (error) throw new Error(`VENTURE_CANDIDATE_ADOPT_FAILED:${error.message}`)
    return (data ?? {}) as AdoptionRpcResult
  })

  for (const policy of policies) {
    const existing = await repository.listCandidateAdoptions(policy.ownerUserId)
    const adoptedIds = new Set(existing.map((record) => record.candidateId))
    const families = policy.allowedFamilies.length ? new Set(policy.allowedFamilies) : null
    const candidates = await repository.listCandidates({
      recommendation: 'research',
      minimumScore: policy.minimumCandidateScore,
      limit: 100,
    })
    const eligible = candidates.filter((candidate) =>
      !adoptedIds.has(candidate.id) &&
      (!families || families.has(candidate.family)),
    ).slice(0, policy.maxAdoptionsPerRun)

    let adoptedCount = 0
    let skippedExisting = 0
    const errors: string[] = []
    for (const candidate of eligible) {
      try {
        const opportunity = ventureCandidateToOpportunity(candidate)
        const response = await adopt(policy.ownerUserId, candidate, opportunity)
        if (response.adopted) adoptedCount += 1
        else if (response.alreadyAdopted) skippedExisting += 1
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'venture_candidate_adopt_failed')
      }
    }
    results.push({
      ownerUserId: policy.ownerUserId,
      considered: eligible.length,
      adopted: adoptedCount,
      skippedExisting,
      errors,
    })
  }

  return {
    status: 'PASS' as const,
    policies: policies.length,
    considered: results.reduce((sum, result) => sum + result.considered, 0),
    adopted: results.reduce((sum, result) => sum + result.adopted, 0),
    skippedExisting: results.reduce((sum, result) => sum + result.skippedExisting, 0),
    errors: results.reduce((sum, result) => sum + result.errors.length, 0),
    results,
    opportunityCreationAuthorized: true as const,
    ventureLaunchAuthorized: false as const,
    automaticExperimentAuthorized: false as const,
    externalActionAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  }
}

export function normalizeDiscoveryPolicy(input: {
  ownerUserId: string
  enabled?: boolean
  autoAdoptCandidates?: boolean
  minimumCandidateScore?: number
  allowedFamilies?: VentureDiscoveryPolicy['allowedFamilies']
  maxAdoptionsPerRun?: number
  updatedAt?: string
}): VentureDiscoveryPolicy {
  const ownerUserId = input.ownerUserId.trim()
  if (!ownerUserId) throw new Error('VENTURE_OWNER_REQUIRED')
  const minimumCandidateScore = input.minimumCandidateScore ?? 75
  if (!Number.isFinite(minimumCandidateScore) || minimumCandidateScore < 0 || minimumCandidateScore > 100) {
    throw new Error('minimumCandidateScore must be between 0 and 100')
  }
  const maxAdoptionsPerRun = input.maxAdoptionsPerRun ?? 3
  if (!Number.isInteger(maxAdoptionsPerRun) || maxAdoptionsPerRun < 1 || maxAdoptionsPerRun > 25) {
    throw new Error('maxAdoptionsPerRun must be between 1 and 25')
  }
  const updatedAt = input.updatedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('updatedAt must be a valid date')
  return {
    ownerUserId,
    enabled: input.enabled ?? false,
    autoAdoptCandidates: input.autoAdoptCandidates ?? false,
    minimumCandidateScore,
    allowedFamilies: [...new Set(input.allowedFamilies ?? [])],
    maxAdoptionsPerRun,
    updatedAt,
  }
}
