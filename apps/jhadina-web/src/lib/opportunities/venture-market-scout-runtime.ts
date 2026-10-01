import { createHash } from 'node:crypto'
import type { SideHustleFamily, VentureMarketSignal } from '@jhadina/opportunity-core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchWebTrends } from '@/lib/growth/webTrendProvider'
import type { TrendObservation } from '@/lib/growth/trendScout'
import { etsyMarketplaceScoutConfigured, runEtsyMarketplaceScout, type EtsyMarketplaceScoutResult } from './etsy-market-scout'
import { VentureRuntimeRepository, type VentureScoutInboxRecord } from './venture-runtime-repository'

export type VentureScoutSeed = {
  id: string
  family: SideHustleFamily
  query: string
  domains?: string[]
  freshnessDays: number
}

export const VENTURE_SCOUT_SEEDS: readonly VentureScoutSeed[] = [
  {
    id: 'pod-personalized-market',
    family: 'pod_personalized_commerce',
    query: 'personalized gifts print on demand buyer trends best selling',
    domains: ['etsy.com', 'pinterest.com', 'reddit.com'],
    freshnessDays: 30,
  },
  {
    id: 'digital-assets-market',
    family: 'digital_products',
    query: '2D game assets UI packs sprites marketplace popular indie game developer',
    domains: ['itch.io', 'assetstore.unity.com', 'fab.com'],
    freshnessDays: 45,
  },
  {
    id: 'thumbnail-service-market',
    family: 'creative_advertising',
    query: 'YouTube thumbnail design service creator demand thumbnails',
    domains: ['fiverr.com', 'upwork.com', 'reddit.com'],
    freshnessDays: 45,
  },
  {
    id: 'micro-saas-market',
    family: 'software_apps',
    query: 'micro SaaS workflow tool launch customer problem small business',
    domains: ['producthunt.com', 'indiehackers.com', 'reddit.com'],
    freshnessDays: 30,
  },
  {
    id: 'owned-media-affiliate-market',
    family: 'owned_media',
    query: 'affiliate content niche buyer intent product comparison search trend',
    domains: ['reddit.com', 'youtube.com', 'substack.com'],
    freshnessDays: 30,
  },
  {
    id: 'business-automation-market',
    family: 'business_automation',
    query: 'small business automation workflow service repetitive manual process demand',
    domains: ['upwork.com', 'reddit.com', 'linkedin.com'],
    freshnessDays: 30,
  },
  {
    id: 'creator-product-market',
    family: 'creator_monetization',
    query: 'creator digital product template membership paid community buyer demand',
    domains: ['gumroad.com', 'patreon.com', 'reddit.com'],
    freshnessDays: 45,
  },
  {
    id: 'boring-service-market',
    family: 'boring_business_services',
    query: 'recurring local business service demand maintenance cleaning admin operations',
    domains: ['yelp.com', 'reddit.com', 'thumbtack.com'],
    freshnessDays: 45,
  },
] as const

export type VentureScoutPersistence = Pick<VentureRuntimeRepository, 'upsertScoutSignals'>

export type VentureWebSearch = (input: {
  query: string
  freshnessDays?: number
  domains?: string[]
}) => Promise<TrendObservation[]>

function stableSignalId(seed: VentureScoutSeed, observation: TrendObservation): string {
  const identity = observation.url?.trim() || observation.title.trim()
  const digest = createHash('sha256')
    .update(`${seed.id}\n${identity}`)
    .digest('hex')
    .slice(0, 24)
  return `venture-signal:${seed.id}:${digest}`
}

function confidenceForObservation(observation: TrendObservation): number {
  let confidence = 0.55
  if (observation.url) confidence += 0.1
  if ((observation.evidence?.length ?? 0) > 0) confidence += 0.1
  if (typeof observation.signals.engagement === 'number' && observation.signals.engagement > 0) confidence += 0.1
  return Math.min(0.9, confidence)
}

export function ventureSignalFromTrend(
  seed: VentureScoutSeed,
  observation: TrendObservation,
): VentureScoutInboxRecord {
  const evidence = (observation.evidence ?? []).slice(0, 5)
  const noteParts = [
    observation.title.trim(),
    observation.signals.topic ? `topic:${observation.signals.topic}` : '',
    evidence.length ? `evidence:${evidence.join(' | ')}` : '',
  ].filter(Boolean)

  const signal: VentureMarketSignal = {
    id: stableSignalId(seed, observation),
    kind: observation.source === 'web' ? 'search' : 'social',
    sourceRef: observation.url ?? `${observation.source}:${observation.title}`,
    observedAt: observation.observedAt,
    value: observation.signals.engagement,
    unit: observation.signals.engagement !== undefined ? 'engagement' : undefined,
    note: noteParts.join(' — '),
    confidence: confidenceForObservation(observation),
  }

  return {
    seedId: seed.id,
    family: seed.family,
    signal,
    sourceUrl: observation.url,
    sourceTitle: observation.title,
  }
}

export async function runVentureMarketScout(
  client: SupabaseClient,
  input: {
    seeds?: readonly VentureScoutSeed[]
    search?: VentureWebSearch
    maxResultsPerSeed?: number
    etsyScout?: (input: { query: string }) => Promise<EtsyMarketplaceScoutResult>
    etsyEnabled?: boolean
    repository?: VentureScoutPersistence
  } = {},
) {
  const seeds = input.seeds ?? VENTURE_SCOUT_SEEDS
  const search = input.search ?? searchWebTrends
  const maxResultsPerSeed = Math.max(1, Math.min(input.maxResultsPerSeed ?? 12, 30))
  const repository = input.repository ?? new VentureRuntimeRepository(client)
  const etsyEnabled = input.etsyEnabled ?? etsyMarketplaceScoutConfigured()
  const etsyScout = input.etsyScout ?? (async ({ query }: { query: string }) =>
    runEtsyMarketplaceScout({
      query,
      family: 'pod_personalized_commerce',
      seedId: 'pod-personalized-market',
    }))
  let etsyResult: {
    configured: boolean
    status: 'skipped' | 'ok' | 'error'
    listingsObserved: number
    shopsObserved: number
    fastGrowthShops: number
    persisted: number
    error?: string
  } = {
    configured: etsyEnabled,
    status: 'skipped',
    listingsObserved: 0,
    shopsObserved: 0,
    fastGrowthShops: 0,
    persisted: 0,
  }
  const records: VentureScoutInboxRecord[] = []
  const seedResults: Array<{
    seedId: string
    family: SideHustleFamily
    observations: number
    persisted: number
    status: 'ok' | 'error'
    error?: string
  }> = []

  for (const seed of seeds) {
    try {
      const observations = await search({
        query: seed.query,
        freshnessDays: seed.freshnessDays,
        domains: seed.domains,
      })
      const selected = observations
        .filter((observation) => Boolean(observation.title?.trim()))
        .slice(0, maxResultsPerSeed)
      const mapped = selected.map((observation) => ventureSignalFromTrend(seed, observation))
      records.push(...mapped)
      const persisted = await repository.upsertScoutSignals(mapped)
      seedResults.push({
        seedId: seed.id,
        family: seed.family,
        observations: selected.length,
        persisted,
        status: 'ok',
      })
    } catch (error) {
      seedResults.push({
        seedId: seed.id,
        family: seed.family,
        observations: 0,
        persisted: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'venture_market_scout_failed',
      })
    }
  }


  if (etsyEnabled) {
    try {
      const native = await etsyScout({ query: 'personalized gifts print on demand' })
      const persisted = await repository.upsertScoutSignals(native.records)
      records.push(...native.records)
      etsyResult = {
        configured: true,
        status: 'ok',
        listingsObserved: native.listingsObserved,
        shopsObserved: native.shopsObserved,
        fastGrowthShops: native.fastGrowthShops,
        persisted,
      }
    } catch (error) {
      etsyResult = {
        configured: true,
        status: 'error',
        listingsObserved: 0,
        shopsObserved: 0,
        fastGrowthShops: 0,
        persisted: 0,
        error: error instanceof Error ? error.message : 'etsy_market_scout_failed',
      }
    }
  }

  const successful = seedResults.filter((result) => result.status === 'ok').length
  const nativeMarketplaceEvidence = etsyResult.status === 'ok' && etsyResult.persisted > 0
  return {
    status: successful === 0 && !nativeMarketplaceEvidence ? 'BLOCKED' as const : 'PROCESSED' as const,
    seeds: seedResults.length,
    successfulSeeds: successful,
    failedSeeds: seedResults.length - successful,
    observations: records.length,
    signalIds: records.map((record) => record.signal.id),
    results: seedResults,
    nativeMarketplaces: { etsy: etsyResult },
    originalityRule: 'MARKET_MECHANICS_NOT_CREATIVE_REPLICATION' as const,
    automaticPublishingAuthorized: false as const,
    automaticOutreachAuthorized: false as const,
    automaticSpendingAuthorized: false as const,
  }
}
