import type { SearchCommerceProductSniperCandidate } from './side-hustle-search-commerce-product-sniper.js'
import { isSearchCommerceFamily } from './side-hustle-search-commerce-operations.js'
import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceProductBindingState = 'verified' | 'retired'

export type SearchCommerceProductBindingReceipt = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  sourceOwner: string
  sourceProductRef: string
  sourceVariantRef: string
  skuRef: string
  targetChannels: readonly string[]
  state: SearchCommerceProductBindingState
  candidateEvidenceRefs: readonly string[]
  bindingEvidenceRefs: readonly string[]
  observedAt: string
  authority: 'PRODUCT_BINDING_EVIDENCE_ONLY'
  sourceAuthorityRetained: true
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export function buildSearchCommerceProductBindingReceipt(input: {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidate: SearchCommerceProductSniperCandidate
  sourceOwner: string
  sourceProductRef: string
  sourceVariantRef: string
  skuRef: string
  targetChannels: readonly string[]
  state?: SearchCommerceProductBindingState
  bindingEvidenceRefs: readonly string[]
  observedAt: string
}): SearchCommerceProductBindingReceipt {
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Product binding requires a Search Commerce family')
  }
  if (
    input.candidate.ventureId !== input.ventureId
    || input.candidate.family !== input.family
  ) {
    throw new Error('Product binding candidate venture/family mismatch')
  }
  if (input.candidate.recommendation === 'reject') {
    throw new Error('Rejected Product Sniper candidate cannot be source-bound')
  }

  const bindingEvidenceRefs = unique(input.bindingEvidenceRefs)
  if (!bindingEvidenceRefs.length) {
    throw new Error('Product binding requires explicit verification evidence')
  }
  const targetChannels = unique(input.targetChannels)
  if (!targetChannels.length) {
    throw new Error('Product binding requires at least one target channel')
  }

  return Object.freeze({
    id: requireText(input.id, 'productBinding.id'),
    ventureId: requireText(input.ventureId, 'productBinding.ventureId'),
    opportunityId: requireText(input.opportunityId, 'productBinding.opportunityId'),
    family: input.family,
    candidateId: input.candidate.id,
    sourceOwner: requireText(input.sourceOwner, 'productBinding.sourceOwner'),
    sourceProductRef: requireText(input.sourceProductRef, 'productBinding.sourceProductRef'),
    sourceVariantRef: requireText(input.sourceVariantRef, 'productBinding.sourceVariantRef'),
    skuRef: requireText(input.skuRef, 'productBinding.skuRef'),
    targetChannels: Object.freeze(targetChannels),
    state: input.state ?? 'verified',
    candidateEvidenceRefs: Object.freeze(unique(input.candidate.evidenceRefs)),
    bindingEvidenceRefs: Object.freeze(bindingEvidenceRefs),
    observedAt: normalizeDate(input.observedAt),
    authority: 'PRODUCT_BINDING_EVIDENCE_ONLY',
    sourceAuthorityRetained: true,
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function isSearchCommerceProductBindingReceipt(
  value: unknown,
): value is SearchCommerceProductBindingReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.candidateId === 'string'
    && typeof record.sourceOwner === 'string'
    && typeof record.sourceProductRef === 'string'
    && typeof record.sourceVariantRef === 'string'
    && typeof record.skuRef === 'string'
    && Array.isArray(record.targetChannels)
    && (record.state === 'verified' || record.state === 'retired')
    && Array.isArray(record.candidateEvidenceRefs)
    && Array.isArray(record.bindingEvidenceRefs)
    && typeof record.observedAt === 'string'
    && record.authority === 'PRODUCT_BINDING_EVIDENCE_ONLY'
    && record.sourceAuthorityRetained === true
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
  if (!Number.isFinite(parsed)) throw new Error('Product binding observedAt must be a valid date')
  return new Date(parsed).toISOString()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
