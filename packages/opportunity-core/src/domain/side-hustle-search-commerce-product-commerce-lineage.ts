import {
  isSearchCommerceFamily,
  type SideHustleFamily,
} from './side-hustles.js'

export type SearchCommerceProductCommerceEventKind =
  | 'checkout'
  | 'order'
  | 'fulfillment'
  | 'delivery'
  | 'refund'
  | 'settlement'

export type SearchCommerceProductCommerceLineage = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productRef: string
  sourceOwner: string
  eventKind: SearchCommerceProductCommerceEventKind
  orderRefs: readonly string[]
  transactionRefs: readonly string[]
  fulfillmentRefs: readonly string[]
  evidenceRefs: readonly string[]
  observedAt: string
  authority: 'SEARCH_COMMERCE_PRODUCT_COMMERCE_LINEAGE_ONLY'
  sourceAuthorityRetained: true
  financialTruthOwnedByOutcomeLedger: true
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export function buildSearchCommerceProductCommerceLineage(input: {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productRef: string
  sourceOwner: string
  eventKind: SearchCommerceProductCommerceEventKind
  orderRefs?: readonly string[]
  transactionRefs?: readonly string[]
  fulfillmentRefs?: readonly string[]
  evidenceRefs: readonly string[]
  observedAt: string
}): SearchCommerceProductCommerceLineage {
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Product Commerce lineage is only registered for Search Commerce families')
  }
  const id = requireText(input.id, 'productCommerce.id')
  const ventureId = requireText(input.ventureId, 'productCommerce.ventureId')
  const opportunityId = requireText(input.opportunityId, 'productCommerce.opportunityId')
  const candidateId = requireText(input.candidateId, 'productCommerce.candidateId')
  const productRef = requireText(input.productRef, 'productCommerce.productRef')
  const sourceOwner = requireText(input.sourceOwner, 'productCommerce.sourceOwner')
  const orderRefs = unique(input.orderRefs ?? [])
  const transactionRefs = unique(input.transactionRefs ?? [])
  const fulfillmentRefs = unique(input.fulfillmentRefs ?? [])
  const evidenceRefs = unique(input.evidenceRefs)
  if (!evidenceRefs.length) throw new Error('Product Commerce lineage requires evidence')
  if (!orderRefs.length && !transactionRefs.length && !fulfillmentRefs.length) {
    throw new Error('Product Commerce lineage requires an order, transaction, or fulfillment reference')
  }

  return Object.freeze({
    id,
    ventureId,
    opportunityId,
    family: input.family,
    candidateId,
    productRef,
    sourceOwner,
    eventKind: input.eventKind,
    orderRefs: Object.freeze(orderRefs),
    transactionRefs: Object.freeze(transactionRefs),
    fulfillmentRefs: Object.freeze(fulfillmentRefs),
    evidenceRefs: Object.freeze(unique([
      ...evidenceRefs,
      ...orderRefs,
      ...transactionRefs,
      ...fulfillmentRefs,
    ])),
    observedAt: normalizeDate(input.observedAt),
    authority: 'SEARCH_COMMERCE_PRODUCT_COMMERCE_LINEAGE_ONLY',
    sourceAuthorityRetained: true,
    financialTruthOwnedByOutcomeLedger: true,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function lineageBindsOutcome(
  lineage: SearchCommerceProductCommerceLineage,
  input: {
    opportunityId: string
    transactionRefs: readonly string[]
  },
): boolean {
  if (lineage.opportunityId !== input.opportunityId) return false
  const outcomeRefs = new Set(unique(input.transactionRefs))
  return lineage.transactionRefs.some((ref) => outcomeRefs.has(ref))
}

export function isSearchCommerceProductCommerceLineage(
  value: unknown,
): value is SearchCommerceProductCommerceLineage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.candidateId === 'string'
    && typeof record.productRef === 'string'
    && typeof record.sourceOwner === 'string'
    && typeof record.eventKind === 'string'
    && Array.isArray(record.orderRefs)
    && Array.isArray(record.transactionRefs)
    && Array.isArray(record.fulfillmentRefs)
    && Array.isArray(record.evidenceRefs)
    && typeof record.observedAt === 'string'
    && record.authority === 'SEARCH_COMMERCE_PRODUCT_COMMERCE_LINEAGE_ONLY'
    && record.sourceAuthorityRetained === true
    && record.financialTruthOwnedByOutcomeLedger === true
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Product Commerce observedAt must be a valid date')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(field + ' is required')
  return normalized
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
