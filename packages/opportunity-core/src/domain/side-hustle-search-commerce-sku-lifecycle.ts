import type { OpportunityOutcomeObservationInput } from './outcome.js'
import {
  isSearchCommerceFamily,
  type SearchCommerceEvidenceKey,
} from './side-hustle-search-commerce-operations.js'
import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceSkuPublicationState =
  | 'submitted'
  | 'published'
  | 'failed'
  | 'unknown'
  | 'withdrawn'

export type SearchCommerceSkuPublicationReceipt = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productTruthId: string
  sourceOwner: string
  productRef: string
  skuRef: string
  channel: string
  externalListingId?: string
  listingUrl?: string
  state: SearchCommerceSkuPublicationState
  governanceRefs: readonly string[]
  observedAt: string
  evidenceRefs: readonly string[]
  authority: 'SKU_PUBLICATION_OBSERVATION_ONLY'
  sourceAuthorityRetained: true
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceSellerSettlementScope = 'shop' | 'sku'
export type SearchCommerceSellerSettlementState =
  | 'pending'
  | 'settled'
  | 'reversed'
  | 'unknown'

export type SearchCommerceSellerSettlementObservation = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  sourceOwner: string
  provider: string
  accountRef: string
  settlementRef: string
  scope: SearchCommerceSellerSettlementScope
  candidateId?: string
  productRef?: string
  skuRef?: string
  currency: string
  grossRevenue: number
  refunds: number
  productCosts: number
  shippingCosts: number
  providerCosts: number
  otherDirectCosts: number
  fees: number
  hours: number
  costBasisComplete: boolean
  state: SearchCommerceSellerSettlementState
  periodStart?: string
  periodEnd?: string
  transactionRefs: readonly string[]
  observedAt: string
  evidenceRefs: readonly string[]
  authority: 'SELLER_SETTLEMENT_OBSERVATION_ONLY'
  sourceAuthorityRetained: true
  externalActionAuthorized: false
  paymentAuthorized: false
  refundAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceLifecycleEvidence = {
  key: SearchCommerceEvidenceKey
  evidenceRefs: readonly string[]
}

export function buildSearchCommerceSkuPublicationReceipt(input: {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productTruthId: string
  sourceOwner: string
  productRef: string
  skuRef: string
  channel: string
  externalListingId?: string
  listingUrl?: string
  state: SearchCommerceSkuPublicationState
  governanceRefs?: readonly string[]
  observedAt: string
  evidenceRefs: readonly string[]
}): SearchCommerceSkuPublicationReceipt {
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('SKU publication receipt requires a Search Commerce family')
  }
  const evidenceRefs = unique(input.evidenceRefs)
  if (!evidenceRefs.length) throw new Error('SKU publication receipt requires evidence')
  const governanceRefs = unique(input.governanceRefs ?? [])
  const externalListingId = input.externalListingId?.trim() || undefined
  const listingUrl = input.listingUrl?.trim() || undefined

  if (input.state === 'published') {
    if (!externalListingId) throw new Error('Published SKU receipt requires external listing identity')
    if (!governanceRefs.length) throw new Error('Published SKU receipt requires governance evidence')
  }
  if (listingUrl) requireUrl(listingUrl, 'listingUrl')

  return Object.freeze({
    id: requireText(input.id, 'skuPublication.id'),
    ventureId: requireText(input.ventureId, 'skuPublication.ventureId'),
    opportunityId: requireText(input.opportunityId, 'skuPublication.opportunityId'),
    family: input.family,
    candidateId: requireText(input.candidateId, 'skuPublication.candidateId'),
    productTruthId: requireText(input.productTruthId, 'skuPublication.productTruthId'),
    sourceOwner: requireText(input.sourceOwner, 'skuPublication.sourceOwner'),
    productRef: requireText(input.productRef, 'skuPublication.productRef'),
    skuRef: requireText(input.skuRef, 'skuPublication.skuRef'),
    channel: requireText(input.channel, 'skuPublication.channel'),
    externalListingId,
    listingUrl,
    state: input.state,
    governanceRefs: Object.freeze(governanceRefs),
    observedAt: normalizeDate(input.observedAt, 'skuPublication.observedAt'),
    evidenceRefs: Object.freeze(unique([...evidenceRefs, ...governanceRefs])),
    authority: 'SKU_PUBLICATION_OBSERVATION_ONLY',
    sourceAuthorityRetained: true,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function buildSearchCommerceSellerSettlementObservation(input: {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  sourceOwner: string
  provider: string
  accountRef: string
  settlementRef: string
  scope: SearchCommerceSellerSettlementScope
  candidateId?: string
  productRef?: string
  skuRef?: string
  currency: string
  grossRevenue: number
  refunds: number
  productCosts: number
  shippingCosts: number
  providerCosts: number
  otherDirectCosts: number
  fees: number
  hours: number
  costBasisComplete: boolean
  state: SearchCommerceSellerSettlementState
  periodStart?: string
  periodEnd?: string
  transactionRefs?: readonly string[]
  observedAt: string
  evidenceRefs: readonly string[]
}): SearchCommerceSellerSettlementObservation {
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Seller settlement requires a Search Commerce family')
  }
  const evidenceRefs = unique(input.evidenceRefs)
  if (!evidenceRefs.length) throw new Error('Seller settlement requires evidence')
  const transactionRefs = unique(input.transactionRefs ?? [])
  if (input.state === 'settled' && !transactionRefs.length) {
    throw new Error('Settled seller observation requires transaction references')
  }
  if (input.scope === 'sku') {
    requireText(input.productRef ?? '', 'sellerSettlement.productRef')
    requireText(input.skuRef ?? '', 'sellerSettlement.skuRef')
  }
  for (const [field, value] of Object.entries({
    grossRevenue: input.grossRevenue,
    refunds: input.refunds,
    productCosts: input.productCosts,
    shippingCosts: input.shippingCosts,
    providerCosts: input.providerCosts,
    otherDirectCosts: input.otherDirectCosts,
    fees: input.fees,
    hours: input.hours,
  })) {
    requireNonNegative(value, 'sellerSettlement.' + field)
  }
  if (input.periodStart) normalizeDate(input.periodStart, 'sellerSettlement.periodStart')
  if (input.periodEnd) normalizeDate(input.periodEnd, 'sellerSettlement.periodEnd')
  if (input.periodStart && input.periodEnd && Date.parse(input.periodEnd) < Date.parse(input.periodStart)) {
    throw new Error('Seller settlement periodEnd cannot predate periodStart')
  }

  return Object.freeze({
    id: requireText(input.id, 'sellerSettlement.id'),
    ventureId: requireText(input.ventureId, 'sellerSettlement.ventureId'),
    opportunityId: requireText(input.opportunityId, 'sellerSettlement.opportunityId'),
    family: input.family,
    sourceOwner: requireText(input.sourceOwner, 'sellerSettlement.sourceOwner'),
    provider: requireText(input.provider, 'sellerSettlement.provider'),
    accountRef: requireText(input.accountRef, 'sellerSettlement.accountRef'),
    settlementRef: requireText(input.settlementRef, 'sellerSettlement.settlementRef'),
    scope: input.scope,
    candidateId: input.candidateId?.trim() || undefined,
    productRef: input.productRef?.trim() || undefined,
    skuRef: input.skuRef?.trim() || undefined,
    currency: requireText(input.currency, 'sellerSettlement.currency').toUpperCase(),
    grossRevenue: roundMoney(input.grossRevenue),
    refunds: roundMoney(input.refunds),
    productCosts: roundMoney(input.productCosts),
    shippingCosts: roundMoney(input.shippingCosts),
    providerCosts: roundMoney(input.providerCosts),
    otherDirectCosts: roundMoney(input.otherDirectCosts),
    fees: roundMoney(input.fees),
    hours: round(input.hours),
    costBasisComplete: input.costBasisComplete,
    state: input.state,
    periodStart: input.periodStart ? normalizeDate(input.periodStart, 'sellerSettlement.periodStart') : undefined,
    periodEnd: input.periodEnd ? normalizeDate(input.periodEnd, 'sellerSettlement.periodEnd') : undefined,
    transactionRefs: Object.freeze(transactionRefs),
    observedAt: normalizeDate(input.observedAt, 'sellerSettlement.observedAt'),
    evidenceRefs: Object.freeze(unique([...evidenceRefs, ...transactionRefs])),
    authority: 'SELLER_SETTLEMENT_OBSERVATION_ONLY',
    sourceAuthorityRetained: true,
    externalActionAuthorized: false,
    paymentAuthorized: false,
    refundAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function sellerSettlementToOpportunityOutcome(
  settlement: SearchCommerceSellerSettlementObservation,
): OpportunityOutcomeObservationInput {
  if (settlement.state !== 'settled') {
    throw new Error('Canonical outcome requires a settled seller observation')
  }
  if (settlement.scope !== 'sku' || !settlement.candidateId || !settlement.productRef || !settlement.skuRef) {
    throw new Error('Product outcome requires explicit SKU/candidate settlement scope')
  }
  if (!settlement.costBasisComplete) {
    throw new Error('Product outcome requires complete realized cost basis')
  }
  if (!settlement.transactionRefs.length) {
    throw new Error('Product outcome requires transaction references')
  }

  const directCosts = roundMoney(
    settlement.productCosts
    + settlement.shippingCosts
    + settlement.providerCosts
    + settlement.otherDirectCosts,
  )
  return Object.freeze({
    id: 'seller-settlement-outcome:' + settlement.id,
    opportunityId: settlement.opportunityId,
    result: settlement.grossRevenue > 0 ? 'won' : 'lost',
    currency: settlement.currency,
    grossRevenue: settlement.grossRevenue,
    refunds: settlement.refunds,
    directCosts,
    fees: settlement.fees,
    hours: settlement.hours,
    sourceOwner: 'commerce',
    evidenceRefs: [...settlement.evidenceRefs],
    transactionRefs: [...settlement.transactionRefs],
    executionRef: settlement.settlementRef,
    observedAt: settlement.observedAt,
    notes: 'Realized SKU seller settlement from ' + settlement.provider + '; source owner ' + settlement.sourceOwner + '.',
  })
}

export function searchCommerceEvidenceFromSkuLifecycle(input: {
  publications?: readonly SearchCommerceSkuPublicationReceipt[]
  settlements?: readonly SearchCommerceSellerSettlementObservation[]
}): readonly SearchCommerceLifecycleEvidence[] {
  const evidence = new Map<SearchCommerceEvidenceKey, Set<string>>()
  const add = (key: SearchCommerceEvidenceKey, refs: readonly string[]) => {
    const normalized = unique(refs)
    if (!normalized.length) return
    const bucket = evidence.get(key) ?? new Set<string>()
    normalized.forEach((ref) => bucket.add(ref))
    evidence.set(key, bucket)
  }

  for (const publication of input.publications ?? []) {
    if (publication.state !== 'published') continue
    add('listings', publication.evidenceRefs)
    add('current listing inventory', publication.evidenceRefs)
    add('current creative/listing state', publication.evidenceRefs)
  }

  for (const settlement of input.settlements ?? []) {
    if (settlement.state !== 'settled') continue
    add('revenue', settlement.evidenceRefs)
    add('refunds/reversals', settlement.evidenceRefs)
    add('fees', settlement.evidenceRefs)
    if (settlement.costBasisComplete) {
      add('product costs', settlement.evidenceRefs)
      add('shipping', settlement.evidenceRefs)
      add('provider costs', settlement.evidenceRefs)
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

export function isSearchCommerceSkuPublicationReceipt(
  value: unknown,
): value is SearchCommerceSkuPublicationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.candidateId === 'string'
    && typeof record.productTruthId === 'string'
    && typeof record.sourceOwner === 'string'
    && typeof record.productRef === 'string'
    && typeof record.skuRef === 'string'
    && typeof record.channel === 'string'
    && typeof record.state === 'string'
    && Array.isArray(record.evidenceRefs)
    && record.authority === 'SKU_PUBLICATION_OBSERVATION_ONLY'
    && record.sourceAuthorityRetained === true
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}

export function isSearchCommerceSellerSettlementObservation(
  value: unknown,
): value is SearchCommerceSellerSettlementObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.sourceOwner === 'string'
    && typeof record.provider === 'string'
    && typeof record.accountRef === 'string'
    && typeof record.settlementRef === 'string'
    && (record.scope === 'shop' || record.scope === 'sku')
    && typeof record.currency === 'string'
    && typeof record.grossRevenue === 'number'
    && typeof record.refunds === 'number'
    && typeof record.productCosts === 'number'
    && typeof record.shippingCosts === 'number'
    && typeof record.providerCosts === 'number'
    && typeof record.otherDirectCosts === 'number'
    && typeof record.fees === 'number'
    && typeof record.hours === 'number'
    && typeof record.costBasisComplete === 'boolean'
    && Array.isArray(record.transactionRefs)
    && Array.isArray(record.evidenceRefs)
    && record.authority === 'SELLER_SETTLEMENT_OBSERVATION_ONLY'
    && record.sourceAuthorityRetained === true
    && record.externalActionAuthorized === false
    && record.paymentAuthorized === false
    && record.refundAuthorized === false
    && record.moneyMovementAuthorized === false
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(field + ' is required')
  return normalized
}

function requireUrl(value: string, field: string): void {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
  } catch {
    throw new Error(field + ' must be an http(s) URL')
  }
}

function requireNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(field + ' must be a non-negative finite number')
}

function normalizeDate(value: string, field: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error(field + ' must be a valid date')
  return new Date(parsed).toISOString()
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
