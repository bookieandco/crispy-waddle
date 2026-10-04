import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceProductBindingReceipt,
  isSearchCommerceFamily,
  type SearchCommerceProductBindingReceipt,
  type SearchCommerceProductSniperCandidate,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'
import { isSearchCommerceProductSniperReport } from './search-commerce-product-sniper-runtime'

export type SearchCommerceProductBindingRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'listReceipts' | 'recordReceipt'
>

export async function recordSearchCommerceProductBindingRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    candidateId: string
    sourceOwner: string
    sourceProductRef: string
    sourceVariantRef: string
    skuRef: string
    targetChannels: readonly string[]
    bindingEvidenceRefs: readonly string[]
    observedAt?: string
  },
  repository: SearchCommerceProductBindingRepository = new VentureRuntimeRepository(client),
): Promise<SearchCommerceProductBindingReceipt> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const candidateId = requireText(input.candidateId, 'candidate')
  const observedAt = normalizeDate(input.observedAt ?? new Date().toISOString())

  const venture = await repository.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_PRODUCT_BINDING_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_BINDING_FAMILY_NOT_SUPPORTED')
  }

  const sourceOwner = requireText(input.sourceOwner, 'source_owner')
  if (!venture.executionOwners.includes(sourceOwner)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_BINDING_SOURCE_OWNER_MISMATCH')
  }

  const candidate = await latestCandidate(
    repository,
    ownerUserId,
    venture.id,
    candidateId,
  )
  if (!candidate) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_BINDING_CANDIDATE_NOT_FOUND')
  }

  const receipt = buildSearchCommerceProductBindingReceipt({
    id: [
      'product-binding',
      sourceOwner,
      input.sourceProductRef,
      input.sourceVariantRef,
      candidateId,
    ].map(stablePart).join(':'),
    ventureId: venture.id,
    opportunityId: venture.opportunityId,
    family: venture.family,
    candidate,
    sourceOwner,
    sourceProductRef: input.sourceProductRef,
    sourceVariantRef: input.sourceVariantRef,
    skuRef: input.skuRef,
    targetChannels: input.targetChannels,
    bindingEvidenceRefs: input.bindingEvidenceRefs,
    observedAt,
  })

  await repository.recordReceipt({
    id: receipt.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'product_binding',
    evidenceRefs: [
      ...receipt.candidateEvidenceRefs,
      ...receipt.bindingEvidenceRefs,
    ],
    payload: {
      opportunityId,
      binding: receipt,
      authority: receipt.authority,
      sourceAuthorityRetained: true,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: receipt.observedAt,
  })

  return receipt
}

async function latestCandidate(
  repository: SearchCommerceProductBindingRepository,
  ownerUserId: string,
  ventureId: string,
  candidateId: string,
): Promise<SearchCommerceProductSniperCandidate | undefined> {
  const receipts = await repository.listReceipts(ownerUserId, 'product_sniper')
  const reports = receipts
    .filter((receipt) => receipt.ventureId === ventureId)
    .map((receipt) => receipt.payload.report)
    .filter(isSearchCommerceProductSniperReport)
    .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt))

  for (const report of reports) {
    const candidate = report.candidates.find((item) => item.id === candidateId)
    if (candidate) return candidate
  }
  return undefined
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_BINDING_' + field.toUpperCase() + '_REQUIRED')
  }
  return normalized
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_BINDING_TIME_INVALID')
  }
  return new Date(parsed).toISOString()
}

function stablePart(value: string): string {
  const normalized = requireText(value, 'identity')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'ref'
}
