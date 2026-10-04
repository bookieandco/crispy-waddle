import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceSellerSettlementObservation,
  buildSearchCommerceSkuPublicationReceipt,
  isSearchCommerceFamily,
  isSearchCommerceProductTruthSnapshot,
  isSearchCommerceSkuPublicationReceipt,
  sellerSettlementToOpportunityOutcome,
  type Opportunity,
  type OpportunityOutcome,
  type SearchCommerceProductSniperCandidate,
  type SearchCommerceProductSniperLearningSnapshot,
  type SearchCommerceProductTruthSnapshot,
  type SearchCommerceSellerSettlementObservation,
  type SearchCommerceSkuPublicationReceipt,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'
import { recordTrustedOpportunityOutcome } from './trusted-opportunity-repository'
import {
  isSearchCommerceProductSniperReport,
} from './search-commerce-product-sniper-runtime'
import {
  recordSearchCommerceProductSniperOutcomeLearning,
} from './search-commerce-product-sniper-learning-runtime'

export type SearchCommerceSkuLifecycleVentureRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'listReceipts' | 'recordReceipt'
>

export type SearchCommerceSkuLifecycleDependencies = {
  ventures: SearchCommerceSkuLifecycleVentureRepository
  getCanonicalOpportunity(ownerUserId: string, opportunityId: string): Promise<Opportunity | undefined>
  recordTrustedOutcome(input: {
    ownerUserId: string
    opportunity: Opportunity
    settlement: SearchCommerceSellerSettlementObservation
  }): Promise<OpportunityOutcome>
  recordProductLearning(input: {
    ownerUserId: string
    opportunityId: string
    candidate: SearchCommerceProductSniperCandidate
    outcomeId: string
    bindingEvidenceRefs: readonly string[]
  }): Promise<SearchCommerceProductSniperLearningSnapshot>
}

type PublicationInput = Omit<
  Parameters<typeof buildSearchCommerceSkuPublicationReceipt>[0],
  'ventureId' | 'opportunityId' | 'family'
>

type SettlementInput = Omit<
  Parameters<typeof buildSearchCommerceSellerSettlementObservation>[0],
  'ventureId' | 'opportunityId' | 'family'
>

export async function recordSearchCommerceSkuPublicationRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    publication: PublicationInput
    dependencies?: SearchCommerceSkuLifecycleDependencies
  },
): Promise<SearchCommerceSkuPublicationReceipt> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const dependencies = input.dependencies ?? defaultDependencies(client)
  const venture = await dependencies.ventures.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_FAMILY_NOT_SUPPORTED')
  }

  const sourceOwner = requireExecutionOwner(venture.executionOwners, input.publication.sourceOwner)
  const productTruth = await requireProductTruth(
    dependencies.ventures,
    ownerUserId,
    venture.id,
    input.publication.productTruthId,
  )
  if (productTruth.candidateId !== input.publication.candidateId) {
    throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_CANDIDATE_MISMATCH')
  }
  if (productTruth.productRef !== input.publication.productRef) {
    throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_PRODUCT_MISMATCH')
  }

  if (input.publication.state === 'published') {
    if (productTruth.catalogStatus !== 'active') {
      throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_PRODUCT_NOT_ACTIVE')
    }
    if (productTruth.policy.status !== 'reviewed') {
      throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_POLICY_NOT_REVIEWED')
    }
    const channel = input.publication.channel.trim().toLowerCase()
    const eligibility = productTruth.channelEligibility.find(
      (item) => item.channel.trim().toLowerCase() === channel,
    )
    if (!eligibility || eligibility.status !== 'eligible') {
      throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_CHANNEL_NOT_ELIGIBLE')
    }
    if (productTruth.fulfillment.certification === 'unknown') {
      throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_FULFILLMENT_UNVERIFIED')
    }
  }

  const receipt = buildSearchCommerceSkuPublicationReceipt({
    ...input.publication,
    ventureId: venture.id,
    opportunityId: venture.opportunityId,
    family: venture.family,
    sourceOwner,
  })

  await dependencies.ventures.recordReceipt({
    id: 'sku-publication:' + venture.id + ':' + receipt.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'sku_publication',
    evidenceRefs: [...receipt.evidenceRefs],
    payload: {
      opportunityId,
      sourceOwner,
      receipt,
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

export async function recordSearchCommerceSellerSettlementRuntime(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    settlement: SettlementInput
    dependencies?: SearchCommerceSkuLifecycleDependencies
  },
): Promise<{
  settlement: SearchCommerceSellerSettlementObservation
  outcome?: OpportunityOutcome
  learning?: SearchCommerceProductSniperLearningSnapshot
  outcomeRecorded: boolean
  learningRecorded: boolean
  blockers: readonly string[]
}> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const dependencies = input.dependencies ?? defaultDependencies(client)
  const venture = await dependencies.ventures.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('SEARCH_COMMERCE_SETTLEMENT_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('SEARCH_COMMERCE_SETTLEMENT_FAMILY_NOT_SUPPORTED')
  }

  const sourceOwner = requireExecutionOwner(venture.executionOwners, input.settlement.sourceOwner)
  const settlement = buildSearchCommerceSellerSettlementObservation({
    ...input.settlement,
    ventureId: venture.id,
    opportunityId: venture.opportunityId,
    family: venture.family,
    sourceOwner,
  })

  await dependencies.ventures.recordReceipt({
    id: 'seller-settlement:' + venture.id + ':' + settlement.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'seller_settlement',
    evidenceRefs: [...settlement.evidenceRefs],
    payload: {
      opportunityId,
      sourceOwner,
      settlement,
      authority: settlement.authority,
      sourceAuthorityRetained: true,
      externalActionAuthorized: false,
      paymentAuthorized: false,
      refundAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: settlement.observedAt,
  })

  const blockers: string[] = []
  if (settlement.state !== 'settled') blockers.push('seller_settlement_not_settled')
  if (settlement.scope !== 'sku') blockers.push('seller_settlement_not_sku_scoped')
  if (!settlement.candidateId || !settlement.productRef || !settlement.skuRef) {
    blockers.push('seller_settlement_candidate_binding_missing')
  }
  if (!settlement.costBasisComplete) blockers.push('seller_settlement_cost_basis_incomplete')
  if (!settlement.transactionRefs.length) blockers.push('seller_settlement_transactions_missing')

  const publication = await findPublishedSkuReceipt(
    dependencies.ventures,
    ownerUserId,
    venture.id,
    settlement,
  )
  if (!publication) blockers.push('seller_settlement_publication_lineage_missing')

  const candidate = settlement.candidateId
    ? await findProductSniperCandidate(
        dependencies.ventures,
        ownerUserId,
        venture.id,
        settlement.candidateId,
      )
    : undefined
  if (!candidate) blockers.push('seller_settlement_product_sniper_candidate_missing')

  const canonical = await dependencies.getCanonicalOpportunity(ownerUserId, venture.opportunityId)
  if (!canonical) {
    blockers.push('seller_settlement_canonical_opportunity_missing')
  } else if (!['ready', 'pursuing', 'won', 'lost'].includes(canonical.status)) {
    blockers.push('seller_settlement_canonical_opportunity_not_outcome_eligible')
  }

  if (blockers.length || !canonical || !candidate || !publication) {
    return Object.freeze({
      settlement,
      outcomeRecorded: false,
      learningRecorded: false,
      blockers: Object.freeze(blockers),
    })
  }

  const outcome = await dependencies.recordTrustedOutcome({
    ownerUserId,
    opportunity: canonical,
    settlement,
  })
  const bindingEvidenceRefs = unique([
    ...settlement.evidenceRefs,
    ...publication.evidenceRefs,
    ...candidate.evidenceRefs,
    'sku-publication:' + publication.id,
    'seller-settlement:' + settlement.id,
  ])
  const learning = await dependencies.recordProductLearning({
    ownerUserId,
    opportunityId: venture.opportunityId,
    candidate,
    outcomeId: outcome.id,
    bindingEvidenceRefs,
  })

  return Object.freeze({
    settlement,
    outcome,
    learning,
    outcomeRecorded: true,
    learningRecorded: true,
    blockers: Object.freeze([]),
  })
}

function defaultDependencies(client: SupabaseClient): SearchCommerceSkuLifecycleDependencies {
  const ventures = new VentureRuntimeRepository(client)
  return {
    ventures,
    async getCanonicalOpportunity(ownerUserId, opportunityId) {
      const { data, error } = await client
        .from('jhadina_opportunities')
        .select('payload')
        .eq('user_id', ownerUserId)
        .eq('id', opportunityId)
        .maybeSingle<{ payload: Opportunity }>()
      if (error) throw new Error('SEARCH_COMMERCE_SETTLEMENT_OPPORTUNITY_READ_FAILED:' + error.message)
      return data?.payload
    },
    async recordTrustedOutcome(input) {
      const observation = sellerSettlementToOpportunityOutcome(input.settlement)
      const result = await recordTrustedOpportunityOutcome(client, {
        userId: input.ownerUserId,
        opportunity: input.opportunity,
        observation,
      })
      return result.outcome
    },
    async recordProductLearning(input) {
      return recordSearchCommerceProductSniperOutcomeLearning(client, {
        ownerUserId: input.ownerUserId,
        opportunityId: input.opportunityId,
        candidateId: input.candidate.id,
        productType: input.candidate.productType,
        marketMechanic: input.candidate.marketMechanic,
        targetChannels: input.candidate.targetChannels,
        outcomeId: input.outcomeId,
        bindingEvidenceRefs: input.bindingEvidenceRefs,
      })
    },
  }
}

async function requireProductTruth(
  repository: SearchCommerceSkuLifecycleVentureRepository,
  ownerUserId: string,
  ventureId: string,
  productTruthId: string,
): Promise<SearchCommerceProductTruthSnapshot> {
  const target = requireText(productTruthId, 'productTruthId')
  const receipts = await repository.listReceipts(ownerUserId, 'product_truth')
  const snapshot = receipts
    .filter((receipt) => receipt.ventureId === ventureId)
    .map((receipt) => receipt.payload.snapshot)
    .filter(isSearchCommerceProductTruthSnapshot)
    .find((item) => item.id === target)
  if (!snapshot) throw new Error('SEARCH_COMMERCE_SKU_PUBLICATION_PRODUCT_TRUTH_NOT_FOUND')
  return snapshot
}

async function findPublishedSkuReceipt(
  repository: SearchCommerceSkuLifecycleVentureRepository,
  ownerUserId: string,
  ventureId: string,
  settlement: SearchCommerceSellerSettlementObservation,
): Promise<SearchCommerceSkuPublicationReceipt | undefined> {
  const receipts = await repository.listReceipts(ownerUserId, 'sku_publication')
  return receipts
    .filter((receipt) => receipt.ventureId === ventureId)
    .map((receipt) => receipt.payload.receipt)
    .filter(isSearchCommerceSkuPublicationReceipt)
    .filter((receipt) => receipt.state === 'published')
    .filter((receipt) => receipt.candidateId === settlement.candidateId)
    .filter((receipt) => receipt.productRef === settlement.productRef)
    .filter((receipt) => receipt.skuRef === settlement.skuRef)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
}

async function findProductSniperCandidate(
  repository: SearchCommerceSkuLifecycleVentureRepository,
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

function requireExecutionOwner(owners: readonly string[], value: string): string {
  const owner = requireText(value, 'sourceOwner')
  if (!owners.includes(owner)) throw new Error('SEARCH_COMMERCE_SOURCE_OWNER_MISMATCH')
  return owner
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('SEARCH_COMMERCE_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
