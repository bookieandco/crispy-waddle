import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceProductTruthSnapshot,
  isSearchCommerceFamily,
  type SearchCommerceProductTruthSnapshot,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceProductTruthRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'recordReceipt'
>

type ProductTruthInput = Omit<
  Parameters<typeof buildSearchCommerceProductTruthSnapshot>[0],
  'ventureId' | 'opportunityId' | 'family'
>

export async function recordSearchCommerceProductTruthRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    productTruth: ProductTruthInput
  },
  repository: SearchCommerceProductTruthRepository = new VentureRuntimeRepository(client),
): Promise<SearchCommerceProductTruthSnapshot> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const venture = await repository.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_PRODUCT_TRUTH_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_TRUTH_FAMILY_NOT_SUPPORTED')
  }

  const sourceOwner = requireText(input.productTruth.sourceOwner, 'source_owner')
  if (!venture.executionOwners.includes(sourceOwner)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_TRUTH_SOURCE_OWNER_MISMATCH')
  }

  const snapshot = buildSearchCommerceProductTruthSnapshot({
    ...input.productTruth,
    ventureId: venture.id,
    opportunityId: venture.opportunityId,
    family: venture.family,
    sourceOwner,
  })

  await repository.recordReceipt({
    id: 'product-truth:' + venture.id + ':' + snapshot.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'product_truth',
    evidenceRefs: [...snapshot.evidenceRefs],
    payload: {
      opportunityId,
      sourceOwner,
      snapshot,
      authority: snapshot.authority,
      sourceAuthorityRetained: true,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: snapshot.observedAt,
  })

  return snapshot
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('SEARCH_COMMERCE_PRODUCT_TRUTH_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}
