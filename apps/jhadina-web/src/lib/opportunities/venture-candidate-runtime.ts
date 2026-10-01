import {
  synthesizeVentureDiscoveryCandidate,
  type VentureCandidateProfile,
  type VentureDiscoveryCandidate,
} from '@jhadina/opportunity-core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export const VENTURE_CANDIDATE_PROFILES: readonly VentureCandidateProfile[] = [
  {
    seedId: 'pod-personalized-market',
    family: 'pod_personalized_commerce',
    title: 'Original personalized gift opportunity',
    buyer: 'Gift buyers who want personal identity, locality, or milestone relevance',
    jobToBeDone: 'Find a meaningful personalized gift without commissioning custom art from scratch',
    paidProblem: 'Generic gifts often lack personal relevance',
    marketMechanic: 'Personalization plus identity, locality, occasion, or nostalgia',
    unmetAngles: ['Under-served local identities', 'Milestone bundles', 'Original modular personalization systems'],
  },
  {
    seedId: 'digital-assets-market',
    family: 'digital_products',
    title: 'Original indie-game asset opportunity',
    buyer: 'Independent game developers and small studios',
    jobToBeDone: 'Ship polished game interfaces and art faster without hiring a full art team',
    paidProblem: 'Small teams need production-ready visual assets faster than custom art pipelines allow',
    marketMechanic: 'Reusable production assets that reduce development time',
    unmetAngles: ['Under-served game genres', 'Coherent expandable asset systems', 'Accessibility-ready UI kits'],
  },
  {
    seedId: 'thumbnail-service-market',
    family: 'creative_advertising',
    title: 'Creator thumbnail service opportunity',
    buyer: 'Video creators and small media teams',
    jobToBeDone: 'Produce differentiated thumbnails quickly enough to support a publishing cadence',
    paidProblem: 'Creators lose time producing or revising conversion-focused thumbnail concepts',
    marketMechanic: 'Fast creative iteration tied to creator identity and content promise',
    unmetAngles: ['Channel-specific design systems', 'Rapid test variants', 'Original branded visual language'],
  },
  {
    seedId: 'micro-saas-market',
    family: 'software_apps',
    title: 'Small-workflow software opportunity',
    buyer: 'Small businesses and operators with repetitive workflow friction',
    jobToBeDone: 'Remove a recurring operational bottleneck without adopting a large enterprise suite',
    paidProblem: 'Narrow repetitive workflows remain manual because broad software is expensive or cumbersome',
    marketMechanic: 'Focused workflow automation with measurable time or error reduction',
    unmetAngles: ['Vertical-specific workflow gaps', 'Concierge-to-software conversion', 'Simple integrations around existing tools'],
  },
  {
    seedId: 'owned-media-affiliate-market',
    family: 'owned_media',
    title: 'Buyer-intent owned-media opportunity',
    buyer: 'Searchers comparing products, services, or solutions before purchase',
    jobToBeDone: 'Make a confident purchase decision from useful comparison or problem-solving content',
    paidProblem: 'Commercial-intent searchers face fragmented, low-trust, or generic information',
    marketMechanic: 'High-intent useful content monetized only after audience value is demonstrated',
    unmetAngles: ['Narrow expert comparison niches', 'First-hand workflow content', 'Evidence-rich buyer guides'],
  },
] as const

export type VentureCandidateRepository = Pick<
  VentureRuntimeRepository,
  'listScoutSignals' | 'upsertCandidates'
>

export async function runVentureCandidateSynthesis(
  client: SupabaseClient,
  input: {
    profiles?: readonly VentureCandidateProfile[]
    generatedAt?: string
    maxSignalsPerCandidate?: number
    repository?: VentureCandidateRepository
  } = {},
) {
  const profiles = input.profiles ?? VENTURE_CANDIDATE_PROFILES
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const maxSignals = Math.max(3, Math.min(input.maxSignalsPerCandidate ?? 25, 100))
  const repository = input.repository ?? new VentureRuntimeRepository(client)
  const candidates: VentureDiscoveryCandidate[] = []
  const results: Array<{
    seedId: string
    signals: number
    recommendation?: VentureDiscoveryCandidate['recommendation']
    score?: number
    status: 'synthesized' | 'no_evidence' | 'error'
    error?: string
  }> = []

  for (const profile of profiles) {
    try {
      const records = await repository.listScoutSignals({
        seedId: profile.seedId,
        family: profile.family,
        limit: maxSignals,
      })
      if (!records.length) {
        results.push({ seedId: profile.seedId, signals: 0, status: 'no_evidence' })
        continue
      }
      const candidate = synthesizeVentureDiscoveryCandidate({
        profile,
        signals: records.map((record) => record.signal),
        generatedAt,
      })
      candidates.push(candidate)
      results.push({
        seedId: profile.seedId,
        signals: candidate.score.signalCount,
        recommendation: candidate.recommendation,
        score: candidate.score.total,
        status: 'synthesized',
      })
    } catch (error) {
      results.push({
        seedId: profile.seedId,
        signals: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'venture_candidate_synthesis_failed',
      })
    }
  }

  const persisted = await repository.upsertCandidates(candidates)
  return {
    status: candidates.length > 0 ? 'PROCESSED' as const : 'BLOCKED' as const,
    profiles: profiles.length,
    synthesized: candidates.length,
    persisted,
    researchReady: candidates.filter((candidate) => candidate.recommendation === 'research').length,
    held: candidates.filter((candidate) => candidate.recommendation === 'hold').length,
    rejected: candidates.filter((candidate) => candidate.recommendation === 'reject').length,
    candidateIds: candidates.map((candidate) => candidate.id),
    results,
    externalActionAuthorized: false as const,
    automaticExperimentAuthorized: false as const,
    directCreativeReplicationAuthorized: false as const,
  }
}
