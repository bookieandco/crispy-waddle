import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceProductCommerceLineage,
  isSearchCommerceFamily,
  isSearchCommerceProductTruthSnapshot,
  type SearchCommerceProductCommerceLineage,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export type SearchCommerceProductCommerceLineageRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'listReceipts' | 'recordReceipt'
>

type LineageInput = Omit<
  Parameters<typeof buildSearchCommerceProductCommerceLineage>[0],
  'ventureId' | 'opportunityId' | 'family'
>

export async function recordSearchCommerceProductCommerceLineageRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    lineage: LineageInput
  },
  repository: SearchCommerceProductCommerceLineageRepository = new VentureRuntimeRepository(client),
): Promise<SearchCommerceProductCommerceLineage> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const venture = await repository.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_PRODUCT_LINEAGE_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_LINEAGE_FAMILY_NOT_SUPPORTED')
  }

  const sourceOwner = requireText(input.lineage.sourceOwner, 'source_owner')
  if (!venture.executionOwners.includes(sourceOwner)) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_LINEAGE_SOURCE_OWNER_MISMATCH')
  }

  const truthReceipts = await repository.listReceipts(ownerUserId, 'product_truth')
  const truth = truthReceipts
    .filter((receipt) => receipt.ventureId === venture.id)
    .map((receipt) => receipt.payload.snapshot)
    .filter(isSearchCommerceProductTruthSnapshot)
    .filter((snapshot) =>
      snapshot.candidateId === input.lineage.candidateId
      && snapshot.productRef === input.lineage.productRef
    )
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]

  if (!truth) {
    throw new Error('SEARCH_COMMERCE_PRODUCT_LINEAGE_PRODUCT_TRUTH_REQUIRED')
  }

  const lineage = buildSearchCommerceProductCommerceLineage({
    ...input.lineage,
    ventureId: venture.id,
    opportunityId: venture.opportunityId,
    family: venture.family,
    sourceOwner,
    evidenceRefs: [
      ...input.lineage.evidenceRefs,
      'product-truth-receipt:' + truth.id,
    ],
  })

  await repository.recordReceipt({
    id: 'product-commerce-lineage:' + venture.id + ':' + lineage.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'product_commerce_lineage',
    evidenceRefs: [...lineage.evidenceRefs],
    payload: {
      opportunityId,
      candidateId: lineage.candidateId,
      productRef: lineage.productRef,
      lineage,
      authority: lineage.authority,
      sourceAuthorityRetained: true,
      financialTruthOwnedByOutcomeLedger: true,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: lineage.observedAt,
  })

  return lineage
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('SEARCH_COMMERCE_PRODUCT_LINEAGE_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}
