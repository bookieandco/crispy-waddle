import {
  isSearchCommerceFamily,
  type SearchCommerceEvidenceKey,
} from './side-hustle-search-commerce-operations.js'
import type {
  SearchCommerceProductSniperSignal,
} from './side-hustle-search-commerce-product-sniper.js'
import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceProductCatalogStatus =
  | 'candidate'
  | 'draft'
  | 'active'
  | 'retired'
  | 'unavailable'

export type SearchCommerceFulfillmentCertification =
  | 'unknown'
  | 'not_applicable'
  | 'mapped'
  | 'sandbox_verified'
  | 'sample_verified'
  | 'live_verified'

export type SearchCommercePolicyStatus =
  | 'unknown'
  | 'reviewed'
  | 'blocked'

export type SearchCommerceProductRiskAssessment = {
  score: number
  confidence: number
  evidenceRefs: readonly string[]
}

export type SearchCommerceProductTruthSnapshot = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId?: string
  sourceOwner: string
  productRef: string
  productType: string
  title: string
  targetChannels: readonly string[]
  catalogStatus: SearchCommerceProductCatalogStatus
  listingRefs: readonly string[]
  creativeAssetRefs: readonly string[]
  providerRefs: readonly string[]
  channelEligibility: readonly {
    channel: string
    status: 'eligible' | 'ineligible' | 'unknown'
    evidenceRefs: readonly string[]
  }[]
  unitEconomics: {
    currency?: string
    retailPrice?: number
    productCost?: number
    merchantShippingCost?: number
    platformFees?: number
    providerCost?: number
    costCompleteness: 'none' | 'partial' | 'complete'
    expectedContributionPerUnit?: number
    expectedMargin?: number
  }
  fulfillment: {
    certification: SearchCommerceFulfillmentCertification
    productionLeadDays?: number
    evidenceRefs: readonly string[]
  }
  policy: {
    status: SearchCommercePolicyStatus
    evidenceRefs: readonly string[]
  }
  risk: {
    platform?: SearchCommerceProductRiskAssessment
    fulfillmentComplexity?: SearchCommerceProductRiskAssessment
    capital?: SearchCommerceProductRiskAssessment
  }
  observedAt: string
  evidenceRefs: readonly string[]
  authority: 'SEARCH_COMMERCE_PRODUCT_TRUTH_PROJECTION_ONLY'
  sourceAuthorityRetained: true
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceProductTruthEvidence = {
  key: SearchCommerceEvidenceKey
  evidenceRefs: readonly string[]
}

export function buildSearchCommerceProductTruthSnapshot(input: {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId?: string
  sourceOwner: string
  productRef: string
  productType: string
  title: string
  targetChannels: readonly string[]
  catalogStatus: SearchCommerceProductCatalogStatus
  listingRefs?: readonly string[]
  creativeAssetRefs?: readonly string[]
  providerRefs?: readonly string[]
  channelEligibility?: readonly {
    channel: string
    status: 'eligible' | 'ineligible' | 'unknown'
    evidenceRefs: readonly string[]
  }[]
  unitEconomics?: {
    currency?: string
    retailPrice?: number
    productCost?: number
    merchantShippingCost?: number
    platformFees?: number
    providerCost?: number
  }
  fulfillment?: {
    certification: SearchCommerceFulfillmentCertification
    productionLeadDays?: number
    evidenceRefs: readonly string[]
  }
  policy?: {
    status: SearchCommercePolicyStatus
    evidenceRefs: readonly string[]
  }
  risk?: {
    platform?: SearchCommerceProductRiskAssessment
    fulfillmentComplexity?: SearchCommerceProductRiskAssessment
    capital?: SearchCommerceProductRiskAssessment
  }
  observedAt: string
  evidenceRefs: readonly string[]
}): SearchCommerceProductTruthSnapshot {
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Product Truth is only registered for Search Commerce families')
  }
  const id = requireText(input.id, 'productTruth.id')
  const ventureId = requireText(input.ventureId, 'productTruth.ventureId')
  const opportunityId = requireText(input.opportunityId, 'productTruth.opportunityId')
  const sourceOwner = requireText(input.sourceOwner, 'productTruth.sourceOwner')
  const productRef = requireText(input.productRef, 'productTruth.productRef')
  const productType = requireText(input.productType, 'productTruth.productType')
  const title = requireText(input.title, 'productTruth.title')
  const targetChannels = unique(input.targetChannels)
  if (!targetChannels.length) throw new Error('Product Truth requires at least one target channel')
  const evidenceRefs = unique(input.evidenceRefs)
  if (!evidenceRefs.length) throw new Error('Product Truth requires evidence references')
  const observedAt = normalizeDate(input.observedAt)

  const listingRefs = unique(input.listingRefs ?? [])
  const creativeAssetRefs = unique(input.creativeAssetRefs ?? [])
  const providerRefs = unique(input.providerRefs ?? [])
  const channelEligibility = (input.channelEligibility ?? []).map((item) => {
    const channel = requireText(item.channel, 'productTruth.channelEligibility.channel')
    const refs = unique(item.evidenceRefs)
    if (!refs.length) throw new Error('Product Truth channel eligibility requires evidence')
    return Object.freeze({
      channel,
      status: item.status,
      evidenceRefs: Object.freeze(refs),
    })
  })

  const unitEconomics = normalizeUnitEconomics(input.unitEconomics)
  const fulfillment = normalizeFulfillment(input.fulfillment)
  const policy = normalizePolicy(input.policy)
  const risk = Object.freeze({
    platform: normalizeRisk(input.risk?.platform, 'platform'),
    fulfillmentComplexity: normalizeRisk(input.risk?.fulfillmentComplexity, 'fulfillmentComplexity'),
    capital: normalizeRisk(input.risk?.capital, 'capital'),
  })

  return Object.freeze({
    id,
    ventureId,
    opportunityId,
    family: input.family,
    candidateId: input.candidateId?.trim() || undefined,
    sourceOwner,
    productRef,
    productType,
    title,
    targetChannels: Object.freeze(targetChannels),
    catalogStatus: input.catalogStatus,
    listingRefs: Object.freeze(listingRefs),
    creativeAssetRefs: Object.freeze(creativeAssetRefs),
    providerRefs: Object.freeze(providerRefs),
    channelEligibility: Object.freeze(channelEligibility),
    unitEconomics,
    fulfillment,
    policy,
    risk,
    observedAt,
    evidenceRefs: Object.freeze(unique([
      ...evidenceRefs,
      ...listingRefs,
      ...creativeAssetRefs,
      ...providerRefs,
      ...channelEligibility.flatMap((item) => item.evidenceRefs),
      ...fulfillment.evidenceRefs,
      ...policy.evidenceRefs,
      ...(risk.platform?.evidenceRefs ?? []),
      ...(risk.fulfillmentComplexity?.evidenceRefs ?? []),
      ...(risk.capital?.evidenceRefs ?? []),
    ])),
    authority: 'SEARCH_COMMERCE_PRODUCT_TRUTH_PROJECTION_ONLY',
    sourceAuthorityRetained: true,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function searchCommerceEvidenceFromProductTruth(
  snapshots: readonly SearchCommerceProductTruthSnapshot[],
): readonly SearchCommerceProductTruthEvidence[] {
  const evidence = new Map<SearchCommerceEvidenceKey, Set<string>>()
  const add = (key: SearchCommerceEvidenceKey, refs: readonly string[]) => {
    const normalized = unique(refs)
    if (!normalized.length) return
    const bucket = evidence.get(key) ?? new Set<string>()
    normalized.forEach((ref) => bucket.add(ref))
    evidence.set(key, bucket)
  }

  for (const snapshot of snapshots) {
    const refs = snapshot.evidenceRefs
    if (snapshot.catalogStatus !== 'unavailable' && snapshot.catalogStatus !== 'retired') {
      add('product candidates', refs)
    }
    if (snapshot.listingRefs.length) {
      add('current listing inventory', snapshot.listingRefs)
      add('listings', snapshot.listingRefs)
      add('current creative/listing state', [...snapshot.listingRefs, ...snapshot.creativeAssetRefs])
    }
    if (snapshot.creativeAssetRefs.length) {
      add('creative assets', snapshot.creativeAssetRefs)
    }
    if (snapshot.unitEconomics.retailPrice !== undefined) add('pricing', refs)
    if (snapshot.unitEconomics.costCompleteness !== 'none') add('expected unit economics', refs)
    if (snapshot.unitEconomics.productCost !== undefined) add('expected product costs', refs)
    if (snapshot.unitEconomics.merchantShippingCost !== undefined) add('expected shipping', refs)
    if (snapshot.unitEconomics.platformFees !== undefined) add('expected platform fees', refs)
    if (snapshot.unitEconomics.providerCost !== undefined) add('expected provider costs', refs)
    if (snapshot.fulfillment.certification !== 'unknown') add('fulfillment observations', snapshot.fulfillment.evidenceRefs)
    if (snapshot.policy.status !== 'unknown') {
      add('policy context', snapshot.policy.evidenceRefs)
      add('policies', snapshot.policy.evidenceRefs)
    }
  }

  return Object.freeze(
    [...evidence.entries()]
      .map(([key, refs]) => Object.freeze({
        key,
        evidenceRefs: Object.freeze([...refs].sort()),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  )
}

export function productTruthToProductSniperSignals(
  snapshot: SearchCommerceProductTruthSnapshot,
): readonly SearchCommerceProductSniperSignal[] {
  const candidateId = snapshot.candidateId
  if (!candidateId) return Object.freeze([])
  const signals: SearchCommerceProductSniperSignal[] = []

  if (snapshot.unitEconomics.expectedMargin !== undefined) {
    signals.push(signal(
      candidateId,
      'margin_potential',
      clamp(snapshot.unitEconomics.expectedMargin * 100, 0, 100),
      0.9,
      snapshot.evidenceRefs[0] ?? snapshot.productRef,
      snapshot.observedAt,
      'Expected unit margin from complete Product Truth cost inputs; planning estimate, not realized profit.',
    ))
  }
  if (snapshot.risk.platform) {
    signals.push(signalFromRisk(candidateId, 'platform_risk', snapshot.risk.platform, snapshot.observedAt))
  }
  if (snapshot.risk.fulfillmentComplexity) {
    signals.push(signalFromRisk(
      candidateId,
      'fulfillment_complexity',
      snapshot.risk.fulfillmentComplexity,
      snapshot.observedAt,
    ))
  }
  if (snapshot.risk.capital) {
    signals.push(signalFromRisk(candidateId, 'capital_risk', snapshot.risk.capital, snapshot.observedAt))
  }

  return Object.freeze(signals)
}

export function isSearchCommerceProductTruthSnapshot(
  value: unknown,
): value is SearchCommerceProductTruthSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.sourceOwner === 'string'
    && typeof record.productRef === 'string'
    && typeof record.productType === 'string'
    && typeof record.title === 'string'
    && Array.isArray(record.targetChannels)
    && typeof record.catalogStatus === 'string'
    && typeof record.observedAt === 'string'
    && Array.isArray(record.evidenceRefs)
    && record.authority === 'SEARCH_COMMERCE_PRODUCT_TRUTH_PROJECTION_ONLY'
    && record.sourceAuthorityRetained === true
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}

function normalizeUnitEconomics(
  value: {
    currency?: string
    retailPrice?: number
    productCost?: number
    merchantShippingCost?: number
    platformFees?: number
    providerCost?: number
  } | undefined,
): SearchCommerceProductTruthSnapshot['unitEconomics'] {
  const normalized = {
    currency: value?.currency?.trim().toUpperCase() || undefined,
    retailPrice: optionalMoney(value?.retailPrice, 'retailPrice'),
    productCost: optionalMoney(value?.productCost, 'productCost'),
    merchantShippingCost: optionalMoney(value?.merchantShippingCost, 'merchantShippingCost'),
    platformFees: optionalMoney(value?.platformFees, 'platformFees'),
    providerCost: optionalMoney(value?.providerCost, 'providerCost'),
  }
  const costValues = [
    normalized.productCost,
    normalized.merchantShippingCost,
    normalized.platformFees,
    normalized.providerCost,
  ]
  const knownCosts = costValues.filter((item): item is number => item !== undefined)
  const costCompleteness: 'none' | 'partial' | 'complete' =
    knownCosts.length === 0 ? 'none' : knownCosts.length === costValues.length ? 'complete' : 'partial'

  if (
    normalized.retailPrice === undefined
    || normalized.currency === undefined
    || costCompleteness !== 'complete'
  ) {
    return Object.freeze({
      ...normalized,
      costCompleteness,
    })
  }

  const totalCosts = knownCosts.reduce((sum, item) => sum + item, 0)
  const expectedContributionPerUnit = round(normalized.retailPrice - totalCosts)
  const expectedMargin = normalized.retailPrice > 0
    ? round(expectedContributionPerUnit / normalized.retailPrice)
    : undefined

  return Object.freeze({
    ...normalized,
    costCompleteness,
    expectedContributionPerUnit,
    expectedMargin,
  })
}

function normalizeFulfillment(
  value: {
    certification: SearchCommerceFulfillmentCertification
    productionLeadDays?: number
    evidenceRefs: readonly string[]
  } | undefined,
): SearchCommerceProductTruthSnapshot['fulfillment'] {
  if (!value) {
    return Object.freeze({
      certification: 'unknown' as const,
      evidenceRefs: Object.freeze([] as string[]),
    })
  }
  if (
    value.productionLeadDays !== undefined
    && (!Number.isInteger(value.productionLeadDays) || value.productionLeadDays < 0)
  ) {
    throw new Error('Product Truth productionLeadDays must be a non-negative integer')
  }
  const refs = unique(value.evidenceRefs)
  if (value.certification !== 'unknown' && !refs.length) {
    throw new Error('Product Truth fulfillment certification requires evidence')
  }
  return Object.freeze({
    certification: value.certification,
    productionLeadDays: value.productionLeadDays,
    evidenceRefs: Object.freeze(refs),
  })
}

function normalizePolicy(
  value: {
    status: SearchCommercePolicyStatus
    evidenceRefs: readonly string[]
  } | undefined,
): SearchCommerceProductTruthSnapshot['policy'] {
  if (!value) {
    return Object.freeze({
      status: 'unknown' as const,
      evidenceRefs: Object.freeze([] as string[]),
    })
  }
  const refs = unique(value.evidenceRefs)
  if (value.status !== 'unknown' && !refs.length) {
    throw new Error('Product Truth policy status requires evidence')
  }
  return Object.freeze({
    status: value.status,
    evidenceRefs: Object.freeze(refs),
  })
}

function normalizeRisk(
  value: SearchCommerceProductRiskAssessment | undefined,
  field: string,
): SearchCommerceProductRiskAssessment | undefined {
  if (!value) return undefined
  requireScore(value.score, 'productTruth.risk.' + field + '.score')
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    throw new Error('productTruth.risk.' + field + '.confidence must be between 0 and 1')
  }
  const refs = unique(value.evidenceRefs)
  if (!refs.length) throw new Error('Product Truth risk assessment requires evidence')
  return Object.freeze({
    score: value.score,
    confidence: value.confidence,
    evidenceRefs: Object.freeze(refs),
  })
}

function signalFromRisk(
  candidateId: string,
  kind: 'platform_risk' | 'fulfillment_complexity' | 'capital_risk',
  risk: SearchCommerceProductRiskAssessment,
  observedAt: string,
): SearchCommerceProductSniperSignal {
  return signal(
    candidateId,
    kind,
    risk.score,
    risk.confidence,
    risk.evidenceRefs[0]!,
    observedAt,
    'Risk score projected from owning-system Product Truth evidence.',
  )
}

function signal(
  candidateId: string,
  kind: SearchCommerceProductSniperSignal['kind'],
  score: number,
  confidence: number,
  sourceRef: string,
  observedAt: string,
  note: string,
): SearchCommerceProductSniperSignal {
  return Object.freeze({
    id: 'product-truth-signal:' + candidateId + ':' + kind,
    kind,
    score,
    confidence,
    sourceRef,
    observedAt,
    note,
  })
}

function optionalMoney(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Product Truth ' + field + ' must be a non-negative finite number')
  }
  return round(value)
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Product Truth observedAt must be a valid date')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(field + ' is required')
  return normalized
}

function requireScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(field + ' must be between 0 and 100')
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
