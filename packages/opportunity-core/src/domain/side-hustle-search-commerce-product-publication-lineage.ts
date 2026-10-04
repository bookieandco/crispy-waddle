import type { SideHustleFamily } from './side-hustles.js'
import { isSearchCommerceFamily } from './side-hustles.js'

export type SearchCommerceProductPublicationLineage = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productRef: string
  sourceOwner: 'social'
  proposalId: string
  outboxId: string
  platform: string
  provider: string
  accountId: string
  providerPostId: string
  state: 'delivered'
  evidenceRefs: readonly string[]
  observedAt: string
  authority: 'SEARCH_COMMERCE_PRODUCT_PUBLICATION_LINEAGE_ONLY'
  socialAuthorityRetained: true
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export function buildSearchCommerceProductPublicationLineage(input: {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productRef: string
  proposalId: string
  outboxId: string
  platform: string
  provider: string
  accountId: string
  providerPostId: string
  observedAt: string
  evidenceRefs: readonly string[]
}): SearchCommerceProductPublicationLineage {
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Product publication lineage is only registered for Search Commerce families')
  }
  const evidenceRefs = unique(input.evidenceRefs)
  if (!evidenceRefs.length) throw new Error('Product publication lineage requires evidence')
  return Object.freeze({
    id: requireText(input.id, 'productPublication.id'),
    ventureId: requireText(input.ventureId, 'productPublication.ventureId'),
    opportunityId: requireText(input.opportunityId, 'productPublication.opportunityId'),
    family: input.family,
    candidateId: requireText(input.candidateId, 'productPublication.candidateId'),
    productRef: requireText(input.productRef, 'productPublication.productRef'),
    sourceOwner: 'social',
    proposalId: requireText(input.proposalId, 'productPublication.proposalId'),
    outboxId: requireText(input.outboxId, 'productPublication.outboxId'),
    platform: requireText(input.platform, 'productPublication.platform'),
    provider: requireText(input.provider, 'productPublication.provider'),
    accountId: requireText(input.accountId, 'productPublication.accountId'),
    providerPostId: requireText(input.providerPostId, 'productPublication.providerPostId'),
    state: 'delivered',
    evidenceRefs: Object.freeze(evidenceRefs),
    observedAt: normalizeDate(input.observedAt),
    authority: 'SEARCH_COMMERCE_PRODUCT_PUBLICATION_LINEAGE_ONLY',
    socialAuthorityRetained: true,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function isSearchCommerceProductPublicationLineage(
  value: unknown,
): value is SearchCommerceProductPublicationLineage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.candidateId === 'string'
    && typeof record.productRef === 'string'
    && record.sourceOwner === 'social'
    && typeof record.proposalId === 'string'
    && typeof record.outboxId === 'string'
    && typeof record.providerPostId === 'string'
    && record.state === 'delivered'
    && Array.isArray(record.evidenceRefs)
    && typeof record.observedAt === 'string'
    && record.authority === 'SEARCH_COMMERCE_PRODUCT_PUBLICATION_LINEAGE_ONLY'
    && record.socialAuthorityRetained === true
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(field + ' is required')
  return normalized
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Product publication observedAt must be valid')
  return new Date(parsed).toISOString()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
