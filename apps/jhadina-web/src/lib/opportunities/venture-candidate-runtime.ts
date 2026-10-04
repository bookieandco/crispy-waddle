import {
  synthesizeVentureDiscoveryCandidate,
  type VentureCandidateProfile,
  type VentureDiscoveryCandidate,
} from '@jhadina/opportunity-core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export const VENTURE_CANDIDATE_PROFILES: readonly VentureCandidateProfile[] = [
  {
    seedId: 'tiktok-affiliate-commerce-market',
    family: 'commerce_affiliate',
    title: 'TikTok Shop affiliate commerce opportunity',
    buyer: 'TikTok Shop shoppers with demonstrated product-category intent',
    jobToBeDone: 'Discover and confidently buy useful products from concise, trustworthy shoppable content',
    paidProblem: 'Shoppers face noisy product discovery while affiliates need evidence-backed products that can convert without owning inventory',
    marketMechanic: 'Match current product demand and commission economics with truthful shoppable creative and attributable conversion',
    unmetAngles: ['New releases with lower creator saturation', 'Evidence-backed product demonstrations', 'Creative optimized on paid-out contribution'],
  },
  {
    seedId: 'tiktok-pod-commerce-market',
    family: 'pod_personalized_commerce',
    title: 'TikTok Shop print-on-demand commerce opportunity',
    buyer: 'TikTok Shop shoppers looking for identity, occasion, gift, or trend-relevant products',
    jobToBeDone: 'Find a distinctive product that feels personally relevant and can be fulfilled reliably after purchase',
    paidProblem: 'Generic products compete heavily while POD offers can fail when fulfillment or margin is not validated first',
    marketMechanic: 'Combine TikTok demand signals with original POD design, fulfillment eligibility, contribution margin, and shoppable creative',
    unmetAngles: ['High-demand low-supply searches', 'Original personalized products from proven demand mechanics', 'TikTok-compatible provider and handling windows'],
  },
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
  {
    seedId: 'business-automation-market',
    family: 'business_automation',
    title: 'Small-business automation service opportunity',
    buyer: 'Small businesses with repetitive manual back-office work',
    jobToBeDone: 'Remove recurring administrative work without building an internal automation team',
    paidProblem: 'Repetitive workflows consume staff time but are too small for enterprise transformation projects',
    marketMechanic: 'Outcome-focused automation sold around a narrow measurable workflow',
    unmetAngles: ['Vertical-specific automations', 'Fixed-scope implementation packs', 'Automation plus exception-management support'],
  },
  {
    seedId: 'creator-product-market',
    family: 'creator_monetization',
    title: 'Creator digital-product opportunity',
    buyer: 'Audience members who want a repeatable shortcut, template, system, or deeper access',
    jobToBeDone: 'Turn trusted creator knowledge into a practical result faster',
    paidProblem: 'Free creator content often lacks a packaged implementation path',
    marketMechanic: 'Productized creator knowledge with recurring or one-time monetization',
    unmetAngles: ['Implementation kits', 'Niche templates', 'Evidence-backed memberships and cohorts'],
  },
  {
    seedId: 'boring-service-market',
    family: 'boring_business_services',
    title: 'Recurring local-service opportunity',
    buyer: 'Local households and small businesses with recurring operational needs',
    jobToBeDone: 'Reliably outsource a necessary recurring task',
    paidProblem: 'Essential local services are fragmented, inconsistent, or administratively inconvenient',
    marketMechanic: 'Reliable recurring service delivery with simple booking and quality control',
    unmetAngles: ['Under-served service zones', 'Recurring plans', 'B2B maintenance bundles'],
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
