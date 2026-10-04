import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isSearchCommerceProductBindingReceipt,
  isSearchCommerceSellerSettlementObservation,
  type SearchCommerceProductBindingReceipt,
  type SearchCommerceProductTruthSnapshot,
  type SearchCommerceSellerSettlementObservation,
  type SearchCommerceSkuPublicationReceipt,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'
import { recordSearchCommerceProductTruthRuntime } from './search-commerce-product-truth-runtime'
import {
  recordSearchCommerceSellerSettlementRuntime,
  recordSearchCommerceSkuPublicationRuntime,
} from './search-commerce-sku-lifecycle-runtime'

type PupsonSourceProduct = {
  productId: string
  variantId: string
  title: string
  variantLabel: string
  productType: string
  retailPriceCents: number
  baseCostCents: number | null
  currency: string
  active: boolean
  certificationStatus: string
  certifiedAt?: string
  provider: string
  providerProductId?: string
  providerVariantId: string
  blueprintId?: string
  printProviderId?: string
  printArea: string
  productionLeadDays?: number
  storefrontPresent: boolean
  liveSellable: boolean
  observedAt: string
  evidenceRefs: string[]
}

type PupsonSourceSettlement = {
  orderId: string
  productId: string
  variantId: string
  state: 'pending' | 'settled'
  blockerCodes: string[]
  currency: string
  grossRevenueCents: number
  refundedAmountCents: number
  stripeFeeCents: number | null
  productCostCents: number | null
  shippingCostCents: number | null
  providerTaxCents: number | null
  costBasisComplete: boolean
  paidAt?: string
  financialObservedAt?: string
  providerCostObservedAt?: string
  transactionRefs: string[]
  evidenceRefs: string[]
  observedAt: string
}

type PupsonSourceProjection = {
  sourceOwner: 'pupsonstuff'
  product: PupsonSourceProduct
  settlements: PupsonSourceSettlement[]
  settlementHoldDays: number
  authority: 'READ_ONLY_SOURCE_PROJECTION'
  externalActionAuthorized: false
  publishingAuthorized: false
  refundAuthorized: false
  moneyMovementAuthorized: false
}

export type PupsonBusinessFactorySyncRepository = Pick<
  VentureRuntimeRepository,
  'listVenturesForSupervisor' | 'listReceipts' | 'getVentureByOpportunity' | 'recordReceipt'
>

export type PupsonBusinessFactorySyncDependencies = {
  ventures: PupsonBusinessFactorySyncRepository
  fetchProjection(binding: SearchCommerceProductBindingReceipt): Promise<PupsonSourceProjection>
  recordProductTruth(input: {
    ownerUserId: string
    opportunityId: string
    productTruth: Parameters<typeof recordSearchCommerceProductTruthRuntime>[1]['productTruth']
  }): Promise<SearchCommerceProductTruthSnapshot>
  recordPublication(input: {
    ownerUserId: string
    opportunityId: string
    publication: Parameters<typeof recordSearchCommerceSkuPublicationRuntime>[1]['publication']
  }): Promise<SearchCommerceSkuPublicationReceipt>
  recordSettlement(input: {
    ownerUserId: string
    opportunityId: string
    settlement: Parameters<typeof recordSearchCommerceSellerSettlementRuntime>[1]['settlement']
  }): ReturnType<typeof recordSearchCommerceSellerSettlementRuntime>
}

export async function runPupsonBusinessFactorySourceSync(
  client: SupabaseClient,
  input: {
    limit?: number
    dependencies?: PupsonBusinessFactorySyncDependencies
  } = {},
) {
  const dependencies = input.dependencies ?? defaultDependencies(client)
  const ventures = (await dependencies.ventures.listVenturesForSupervisor(input.limit ?? 100))
    .filter(({ venture }) => venture.family === 'pod_personalized_commerce')

  const results: Array<{
    ownerUserId: string
    ventureId: string
    bindingId: string
    productTruthRecorded: boolean
    publicationRecorded: boolean
    settlementsObserved: number
    settlementsFinalized: number
    outcomesRecorded: number
    learningRecorded: number
    lateAdjustments: number
    blockers: string[]
  }> = []

  for (const { ownerUserId, venture } of ventures) {
    const [bindingReceipts, settlementReceipts] = await Promise.all([
      dependencies.ventures.listReceipts(ownerUserId, 'product_binding'),
      dependencies.ventures.listReceipts(ownerUserId, 'seller_settlement'),
    ])
    const bindings = latestVerifiedPupsonBindings(bindingReceipts, venture.id)
    const existingSettlements = settlementReceipts
      .filter((receipt) => receipt.ventureId === venture.id)
      .map((receipt) => receipt.payload.settlement)
      .filter(isSearchCommerceSellerSettlementObservation)

    for (const binding of bindings) {
      const row = {
        ownerUserId,
        ventureId: venture.id,
        bindingId: binding.id,
        productTruthRecorded: false,
        publicationRecorded: false,
        settlementsObserved: 0,
        settlementsFinalized: 0,
        outcomesRecorded: 0,
        learningRecorded: 0,
        lateAdjustments: 0,
        blockers: [] as string[],
      }
      try {
        const projection = await dependencies.fetchProjection(binding)
        validateProjection(binding, projection)

        const productRef = 'pupson:' + binding.sourceProductRef
        const ownStoreTarget = binding.targetChannels.some(
          (channel) => normalizeChannel(channel) === 'pupsonstuff',
        )
        const productTruth = await dependencies.recordProductTruth({
          ownerUserId,
          opportunityId: venture.opportunityId,
          productTruth: {
            id: 'pupson-product-truth:' + binding.id,
            candidateId: binding.candidateId,
            sourceOwner: 'pupsonstuff',
            productRef,
            productType: projection.product.productType,
            title: [projection.product.title, projection.product.variantLabel]
              .filter(Boolean)
              .join(' — '),
            targetChannels: binding.targetChannels,
            catalogStatus:
              binding.state === 'retired'
                ? 'retired'
                : projection.product.active && projection.product.storefrontPresent
                  ? 'active'
                  : 'unavailable',
            listingRefs: [],
            creativeAssetRefs: [],
            providerRefs: unique([
              projection.product.providerProductId
                ? 'printify-product:' + projection.product.providerProductId
                : '',
              'printify-variant:' + projection.product.providerVariantId,
              projection.product.blueprintId
                ? 'printify-blueprint:' + projection.product.blueprintId
                : '',
              projection.product.printProviderId
                ? 'printify-provider:' + projection.product.printProviderId
                : '',
            ]),
            channelEligibility: binding.targetChannels.map((channel) => ({
              channel,
              status: normalizeChannel(channel) === 'pupsonstuff'
                ? projection.product.liveSellable ? 'eligible' : 'ineligible'
                : 'unknown',
              evidenceRefs: unique([
                ...projection.product.evidenceRefs,
                ...binding.bindingEvidenceRefs,
              ]),
            })),
            unitEconomics: {
              currency: projection.product.currency,
              retailPrice: cents(projection.product.retailPriceCents),
              productCost: projection.product.baseCostCents === null
                ? undefined
                : cents(projection.product.baseCostCents),
            },
            fulfillment: {
              certification: fulfillmentCertification(projection.product.certificationStatus),
              productionLeadDays: projection.product.productionLeadDays,
              evidenceRefs: projection.product.evidenceRefs,
            },
            policy: {
              status: ownStoreTarget && projection.product.liveSellable
                ? 'reviewed'
                : 'unknown',
              evidenceRefs: ownStoreTarget && projection.product.liveSellable
                ? unique([
                    ...binding.bindingEvidenceRefs,
                    ...projection.product.evidenceRefs,
                  ])
                : [],
            },
            observedAt: projection.product.observedAt,
            evidenceRefs: unique([
              ...binding.candidateEvidenceRefs,
              ...binding.bindingEvidenceRefs,
              ...projection.product.evidenceRefs,
            ]),
          },
        })
        row.productTruthRecorded = true

        if (ownStoreTarget && projection.product.liveSellable) {
          await dependencies.recordPublication({
            ownerUserId,
            opportunityId: venture.opportunityId,
            publication: {
              id: 'pupson-storefront-publication:' + binding.id,
              candidateId: binding.candidateId,
              productTruthId: productTruth.id,
              sourceOwner: 'pupsonstuff',
              productRef,
              skuRef: binding.skuRef,
              channel: 'pupsonstuff',
              externalListingId:
                binding.sourceProductRef + ':' + binding.sourceVariantRef,
              state: 'published',
              governanceRefs: unique([
                binding.id,
                ...binding.bindingEvidenceRefs,
                ...projection.product.evidenceRefs,
              ]),
              observedAt: projection.product.observedAt,
              evidenceRefs: unique([
                ...projection.product.evidenceRefs,
                'pupson-live-sellable:' + binding.sourceProductRef + ':' + binding.sourceVariantRef,
              ]),
            },
          })
          row.publicationRecorded = true
        }

        for (const settlementProjection of projection.settlements) {
          row.settlementsObserved += 1
          const settlementRef = 'pupson-order:' + settlementProjection.orderId
          const priorSettled = existingSettlements
            .filter((item) => item.settlementRef === settlementRef && item.state === 'settled')
            .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]

          const economicsChanged = priorSettled
            ? settlementEconomicsSignature(priorSettled) !==
              sourceSettlementEconomicsSignature(settlementProjection)
            : false

          if (priorSettled && !economicsChanged) continue

          const lateAdjustment = Boolean(priorSettled && economicsChanged)
          const state = lateAdjustment
            ? 'reversed' as const
            : settlementProjection.state
          const settlementId = lateAdjustment
            ? [
                'pupson-settlement-adjustment',
                settlementProjection.orderId,
                stableSuffix(settlementProjection.observedAt),
              ].join(':')
            : 'pupson-settlement:' + settlementProjection.orderId

          const result = await dependencies.recordSettlement({
            ownerUserId,
            opportunityId: venture.opportunityId,
            settlement: {
              id: settlementId,
              sourceOwner: 'pupsonstuff',
              provider: 'pupsonstuff',
              accountRef: 'pupsonstuff:owned-store',
              settlementRef,
              scope: 'sku',
              candidateId: binding.candidateId,
              productRef,
              skuRef: binding.skuRef,
              currency: settlementProjection.currency,
              grossRevenue: cents(settlementProjection.grossRevenueCents),
              refunds: cents(settlementProjection.refundedAmountCents),
              productCosts: cents(settlementProjection.productCostCents ?? 0),
              shippingCosts: cents(settlementProjection.shippingCostCents ?? 0),
              providerCosts: 0,
              otherDirectCosts: cents(settlementProjection.providerTaxCents ?? 0),
              fees: cents(settlementProjection.stripeFeeCents ?? 0),
              hours: 0,
              costBasisComplete: settlementProjection.costBasisComplete,
              state,
              transactionRefs: settlementProjection.transactionRefs,
              observedAt: settlementProjection.observedAt,
              evidenceRefs: unique([
                ...binding.bindingEvidenceRefs,
                ...settlementProjection.evidenceRefs,
                ...settlementProjection.blockerCodes.map((code) => 'pupson-settlement-blocker:' + code),
              ]),
            },
          })

          if (lateAdjustment) row.lateAdjustments += 1
          if (state === 'settled') row.settlementsFinalized += 1
          if (result.outcomeRecorded) row.outcomesRecorded += 1
          if (result.learningRecorded) row.learningRecorded += 1
          row.blockers.push(...result.blockers)
        }
      } catch (error) {
        row.blockers.push(
          error instanceof Error ? error.message : 'PUPSON_BUSINESS_FACTORY_SYNC_FAILED',
        )
      }
      results.push(row)
    }
  }

  return Object.freeze({
    status: results.some((item) => item.blockers.length > 0) ? 'PARTIAL' as const : 'PASS' as const,
    ventures: ventures.length,
    bindings: results.length,
    productTruthRecorded: results.filter((item) => item.productTruthRecorded).length,
    publicationRecorded: results.filter((item) => item.publicationRecorded).length,
    settlementsObserved: results.reduce((sum, item) => sum + item.settlementsObserved, 0),
    settlementsFinalized: results.reduce((sum, item) => sum + item.settlementsFinalized, 0),
    outcomesRecorded: results.reduce((sum, item) => sum + item.outcomesRecorded, 0),
    learningRecorded: results.reduce((sum, item) => sum + item.learningRecorded, 0),
    lateAdjustments: results.reduce((sum, item) => sum + item.lateAdjustments, 0),
    results: Object.freeze(results),
    authority: 'READ_ONLY_SOURCE_SYNC' as const,
    externalActionAuthorized: false as const,
    publishingAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  })
}

function defaultDependencies(client: SupabaseClient): PupsonBusinessFactorySyncDependencies {
  const ventures = new VentureRuntimeRepository(client)
  return {
    ventures,
    fetchProjection: createPupsonProjectionFetcher(),
    recordProductTruth: (input) =>
      recordSearchCommerceProductTruthRuntime(client, input, ventures),
    recordPublication: (input) =>
      recordSearchCommerceSkuPublicationRuntime(client, input),
    recordSettlement: (input) =>
      recordSearchCommerceSellerSettlementRuntime(client, input),
  }
}

function createPupsonProjectionFetcher(): PupsonBusinessFactorySyncDependencies['fetchProjection'] {
  const origin = process.env.PUPSON_BUSINESS_FACTORY_ORIGIN?.trim().replace(/\/$/, '')
  const token = process.env.PUPSON_BUSINESS_FACTORY_TOKEN?.trim()
  if (!origin || !token) {
    return async () => {
      throw new Error('PUPSON_BUSINESS_FACTORY_SOURCE_NOT_CONFIGURED')
    }
  }

  return async (binding) => {
    const url = new URL('/api/internal/business-factory/source', origin)
    url.searchParams.set('productId', binding.sourceProductRef)
    url.searchParams.set('variantId', binding.sourceVariantRef)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer ' + token,
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error('PUPSON_BUSINESS_FACTORY_SOURCE_HTTP_' + response.status)
    }
    const payload = await response.json() as {
      success?: unknown
      projection?: unknown
    }
    if (payload.success !== true || !isPupsonProjection(payload.projection)) {
      throw new Error('PUPSON_BUSINESS_FACTORY_SOURCE_INVALID')
    }
    return payload.projection
  }
}

function latestVerifiedPupsonBindings(
  receipts: Awaited<ReturnType<PupsonBusinessFactorySyncRepository['listReceipts']>>,
  ventureId: string,
): SearchCommerceProductBindingReceipt[] {
  const byId = new Map<string, SearchCommerceProductBindingReceipt>()
  for (const receipt of receipts) {
    if (receipt.ventureId !== ventureId) continue
    const binding = receipt.payload.binding
    if (!isSearchCommerceProductBindingReceipt(binding)) continue
    if (binding.sourceOwner !== 'pupsonstuff') continue
    const prior = byId.get(binding.id)
    if (!prior || Date.parse(binding.observedAt) >= Date.parse(prior.observedAt)) {
      byId.set(binding.id, binding)
    }
  }
  return [...byId.values()]
    .filter((binding) => binding.state === 'verified')
    .sort((a, b) => a.id.localeCompare(b.id))
}

function validateProjection(
  binding: SearchCommerceProductBindingReceipt,
  projection: PupsonSourceProjection,
): void {
  if (projection.sourceOwner !== 'pupsonstuff') {
    throw new Error('PUPSON_BUSINESS_FACTORY_SOURCE_OWNER_MISMATCH')
  }
  if (
    projection.product.productId !== binding.sourceProductRef ||
    projection.product.variantId !== binding.sourceVariantRef
  ) {
    throw new Error('PUPSON_BUSINESS_FACTORY_PRODUCT_BINDING_MISMATCH')
  }
  if (
    projection.authority !== 'READ_ONLY_SOURCE_PROJECTION' ||
    projection.externalActionAuthorized !== false ||
    projection.publishingAuthorized !== false ||
    projection.refundAuthorized !== false ||
    projection.moneyMovementAuthorized !== false
  ) {
    throw new Error('PUPSON_BUSINESS_FACTORY_SOURCE_AUTHORITY_INVALID')
  }
}

function isPupsonProjection(value: unknown): value is PupsonSourceProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.sourceOwner !== 'pupsonstuff') return false
  if (record.authority !== 'READ_ONLY_SOURCE_PROJECTION') return false
  if (record.externalActionAuthorized !== false) return false
  if (record.publishingAuthorized !== false) return false
  if (record.refundAuthorized !== false) return false
  if (record.moneyMovementAuthorized !== false) return false
  if (!record.product || typeof record.product !== 'object' || Array.isArray(record.product)) return false
  if (!Array.isArray(record.settlements)) return false
  const product = record.product as Record<string, unknown>
  return typeof product.productId === 'string'
    && typeof product.variantId === 'string'
    && typeof product.title === 'string'
    && typeof product.productType === 'string'
    && typeof product.retailPriceCents === 'number'
    && typeof product.currency === 'string'
    && typeof product.active === 'boolean'
    && typeof product.certificationStatus === 'string'
    && typeof product.providerVariantId === 'string'
    && typeof product.printArea === 'string'
    && typeof product.storefrontPresent === 'boolean'
    && typeof product.liveSellable === 'boolean'
    && typeof product.observedAt === 'string'
    && Array.isArray(product.evidenceRefs)
}

function fulfillmentCertification(
  status: string,
): 'unknown' | 'mapped' | 'sandbox_verified' | 'sample_verified' {
  switch (status) {
    case 'sample_verified': return 'sample_verified'
    case 'sandbox_verified': return 'sandbox_verified'
    case 'uncertified': return 'mapped'
    default: return 'unknown'
  }
}

function settlementEconomicsSignature(
  settlement: SearchCommerceSellerSettlementObservation,
): string {
  return JSON.stringify({
    currency: settlement.currency,
    grossRevenue: settlement.grossRevenue,
    refunds: settlement.refunds,
    productCosts: settlement.productCosts,
    shippingCosts: settlement.shippingCosts,
    providerCosts: settlement.providerCosts,
    otherDirectCosts: settlement.otherDirectCosts,
    fees: settlement.fees,
    costBasisComplete: settlement.costBasisComplete,
  })
}

function sourceSettlementEconomicsSignature(
  settlement: PupsonSourceSettlement,
): string {
  return JSON.stringify({
    currency: settlement.currency,
    grossRevenue: cents(settlement.grossRevenueCents),
    refunds: cents(settlement.refundedAmountCents),
    productCosts: cents(settlement.productCostCents ?? 0),
    shippingCosts: cents(settlement.shippingCostCents ?? 0),
    providerCosts: 0,
    otherDirectCosts: cents(settlement.providerTaxCents ?? 0),
    fees: cents(settlement.stripeFeeCents ?? 0),
    costBasisComplete: settlement.costBasisComplete,
  })
}

function cents(value: number): number {
  return Math.round(value) / 100
}

function normalizeChannel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function stableSuffix(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, 24)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
