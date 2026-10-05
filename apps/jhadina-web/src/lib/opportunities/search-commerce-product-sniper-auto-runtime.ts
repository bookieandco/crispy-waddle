import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SearchCommerceProductSniperCandidateInput,
  SearchCommerceProductSniperSignal,
  SideHustleFamily,
} from '@jhadina/opportunity-core'
import {
  VentureRuntimeRepository,
  type VentureScoutInboxRecord,
} from './venture-runtime-repository'
import {
  runSearchCommerceProductSniperRuntime,
  type SearchCommerceProductSniperRepository,
} from './search-commerce-product-sniper-runtime'

export type SearchCommerceProductSniperAutoRepository =
  Pick<VentureRuntimeRepository, 'listVenturesForSupervisor' | 'listScoutSignals'>
  & SearchCommerceProductSniperRepository

export async function runSearchCommerceProductSniperAutoCycle(
  client: SupabaseClient,
  input: {
    now?: string
    limitVentures?: number
    maxCandidatesPerVenture?: number
    repository?: SearchCommerceProductSniperAutoRepository
  } = {},
) {
  const now = normalizeDate(input.now ?? new Date().toISOString())
  const limitVentures = bounded(input.limitVentures ?? 100, 1, 500)
  const maxCandidates = bounded(input.maxCandidatesPerVenture ?? 20, 1, 50)
  const repository = input.repository ?? new VentureRuntimeRepository(client)

  const all = await repository.listVenturesForSupervisor(limitVentures)
  const ventures = all.filter(({ venture }) => venture.family === 'pod_personalized_commerce')
  const results: Array<{
    ownerUserId: string
    ventureId: string
    observedListings: number
    candidates: number
    held: number
    researchReady: number
    rejected: number
    evidenceGapWork: number
    status: 'ranked' | 'no_listing_evidence'
  }> = []

  for (const { ownerUserId, venture } of ventures) {
    const records = await repository.listScoutSignals({
      seedId: 'pod-personalized-market',
      family: venture.family,
      limit: 500,
    })
    const listingRecords = records
      .filter(isEtsyListingAttentionRecord)
      .sort((a, b) =>
        numericValue(b.signal.value) - numericValue(a.signal.value)
        || Date.parse(b.signal.observedAt) - Date.parse(a.signal.observedAt)
        || a.signal.id.localeCompare(b.signal.id),
      )
      .slice(0, maxCandidates)

    if (!listingRecords.length) {
      results.push({
        ownerUserId,
        ventureId: venture.id,
        observedListings: 0,
        candidates: 0,
        held: 0,
        researchReady: 0,
        rejected: 0,
        evidenceGapWork: 0,
        status: 'no_listing_evidence',
      })
      continue
    }

    const candidates = listingRecords.map((record) =>
      buildObservedEtsyCandidate({
        ventureId: venture.id,
        family: venture.family,
        record,
        comparisonSet: listingRecords,
        evaluatedAt: now,
      }),
    )

    const report = await runSearchCommerceProductSniperRuntime(
      client,
      {
        ownerUserId,
        opportunityId: venture.opportunityId,
        candidates,
        evaluatedAt: now,
      },
      repository,
    )

    const work = await repository.listWorkItems(ownerUserId, venture.id)
    results.push({
      ownerUserId,
      ventureId: venture.id,
      observedListings: listingRecords.length,
      candidates: report.candidates.length,
      held: report.holdQueue.length,
      researchReady: report.researchQueue.length,
      rejected: report.rejected.length,
      evidenceGapWork: work.filter((item) =>
        item.status === 'queued'
        && item.step.startsWith('product_sniper:evidence_gap:'),
      ).length,
      status: 'ranked',
    })
  }

  return Object.freeze({
    status: 'PASS' as const,
    observedAt: now,
    scannedVentures: all.length,
    eligibleVentures: ventures.length,
    rankedVentures: results.filter((item) => item.status === 'ranked').length,
    noEvidenceVentures: results.filter((item) => item.status === 'no_listing_evidence').length,
    candidates: results.reduce((sum, item) => sum + item.candidates, 0),
    held: results.reduce((sum, item) => sum + item.held, 0),
    researchReady: results.reduce((sum, item) => sum + item.researchReady, 0),
    rejected: results.reduce((sum, item) => sum + item.rejected, 0),
    evidenceGapWork: results.reduce((sum, item) => sum + item.evidenceGapWork, 0),
    results: Object.freeze(results),
    sourceClaims: Object.freeze([
      'Etsy listing favorites are treated as relative attention evidence, not per-listing sales.',
      'Observed Etsy availability supports only weak channel compatibility, not conversion or profitability.',
      'Buyer intent, competition headroom, margin, fulfillment, originality clearance, and capital facts remain explicit evidence gaps until separately supported.',
    ]),
    authority: 'PRODUCT_SNIPER_AUTO_INTAKE_RESEARCH_ONLY' as const,
    externalActionAuthorized: false as const,
    publishingAuthorized: false as const,
    purchasingAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  })
}

export function buildObservedEtsyCandidate(input: {
  ventureId: string
  family: SideHustleFamily
  record: VentureScoutInboxRecord
  comparisonSet: readonly VentureScoutInboxRecord[]
  evaluatedAt: string
}): Omit<
  SearchCommerceProductSniperCandidateInput,
  'learningSnapshot'
> {
  if (!isEtsyListingAttentionRecord(input.record)) {
    throw new Error('PRODUCT_SNIPER_AUTO_ETSY_LISTING_ATTENTION_REQUIRED')
  }
  const title = input.record.sourceTitle.trim()
  const sourceRef = input.record.signal.sourceRef
  const productType = inferProductType(title)
  const demandScore = relativeAttentionScore(input.record, input.comparisonSet)

  const signals: SearchCommerceProductSniperSignal[] = [
    {
      id: 'product-sniper-auto:' + stablePart(input.record.signal.id) + ':demand',
      kind: 'demand',
      score: demandScore,
      confidence: input.record.signal.confidence,
      sourceRef,
      observedAt: input.record.signal.observedAt,
      note: 'Relative Etsy favorites rank within the current observed listing batch; this is attention evidence, not sales attribution.',
    },
    {
      id: 'product-sniper-auto:' + stablePart(input.record.signal.id) + ':channel-fit',
      kind: 'channel_fit',
      score: 65,
      confidence: 0.6,
      sourceRef,
      observedAt: input.record.signal.observedAt,
      note: 'An active Etsy listing demonstrates marketplace compatibility for the observed product class only; conversion and profitability are not claimed.',
    },
  ]

  return {
    id: 'sniper:auto:etsy:' + stablePart(input.record.signal.id),
    ventureId: input.ventureId,
    family: input.family,
    title: 'Research opportunity: ' + title,
    productType,
    buyer: 'Etsy shopper showing interest in the observed product theme',
    marketMechanic: 'Observed Etsy listing attention; listing favorites are treated as demand evidence while per-listing sales remain unclaimed.',
    originalConcept: 'Research an original ' + productType + ' concept serving the observed buyer interest without copying the source listing wording, imagery, characters, layout, or protected creative.',
    targetChannels: ['etsy'],
    signals,
    competitorArtifactRefs: [sourceRef],
    originalityEvidenceRefs: [
      sourceRef,
      'policy:product-sniper:market-mechanics-only:no-direct-replication',
    ],
    evaluatedAt: normalizeDate(input.evaluatedAt),
  }
}

function isEtsyListingAttentionRecord(record: VentureScoutInboxRecord): boolean {
  return record.seedId === 'pod-personalized-market'
    && record.family === 'pod_personalized_commerce'
    && record.signal.kind === 'platform_velocity'
    && record.signal.unit === 'listing_favorers'
    && typeof record.signal.value === 'number'
    && Number.isFinite(record.signal.value)
    && record.signal.value >= 0
    && Boolean(record.sourceTitle.trim())
    && /etsy\.com/i.test(record.signal.sourceRef)
}

function relativeAttentionScore(
  target: VentureScoutInboxRecord,
  records: readonly VentureScoutInboxRecord[],
): number {
  const values = records
    .filter(isEtsyListingAttentionRecord)
    .map((record) => numericValue(record.signal.value))
    .sort((a, b) => a - b)
  if (!values.length) return 50
  const value = numericValue(target.signal.value)
  if (values.length === 1) return 60
  const belowOrEqual = values.filter((candidate) => candidate <= value).length
  const percentile = (belowOrEqual - 1) / (values.length - 1)
  return round(45 + percentile * 45)
}

function inferProductType(title: string): string {
  const normalized = title.toLowerCase()
  const patterns: Array<[RegExp, string]> = [
    [/\bornament(s)?\b/, 'ornament'],
    [/\bmug(s)?\b/, 'mug'],
    [/\b(t[- ]?shirt|tee|shirt)s?\b/, 'shirt'],
    [/\bhoodie(s)?\b/, 'hoodie'],
    [/\bposter(s)?\b/, 'poster'],
    [/\b(print|wall art)\b/, 'art-print'],
    [/\bblanket(s)?\b/, 'blanket'],
    [/\bpillow(s)?\b/, 'pillow'],
    [/\btote(s)?\b/, 'tote-bag'],
    [/\bsticker(s)?\b/, 'sticker'],
    [/\b(phone case|iphone case|case)\b/, 'phone-case'],
    [/\b(card|invitation)s?\b/, 'card'],
    [/\bsign(s)?\b/, 'sign'],
    [/\bnecklace(s)?\b/, 'necklace'],
    [/\bbracelet(s)?\b/, 'bracelet'],
  ]
  return patterns.find(([pattern]) => pattern.test(normalized))?.[1] ?? 'marketplace-product'
}

function numericValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('PRODUCT_SNIPER_AUTO_TIME_INVALID')
  return new Date(parsed).toISOString()
}

function stablePart(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'listing'
}

function bounded(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error('PRODUCT_SNIPER_AUTO_BOUND_INVALID')
  }
  return value
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
