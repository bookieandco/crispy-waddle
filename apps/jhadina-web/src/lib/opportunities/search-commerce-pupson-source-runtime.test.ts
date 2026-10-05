import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SearchCommerceProductBindingReceipt,
  SearchCommerceProductTruthSnapshot,
  SearchCommerceSellerSettlementObservation,
  SearchCommerceSkuPublicationReceipt,
  VentureOpportunity,
} from '@jhadina/opportunity-core'
import {
  runPupsonBusinessFactorySourceSync,
  type PupsonBusinessFactorySyncDependencies,
} from './search-commerce-pupson-source-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
} as unknown as VentureOpportunity

const binding: SearchCommerceProductBindingReceipt = {
  id: 'binding:1',
  ventureId: venture.id,
  opportunityId: venture.opportunityId,
  family: venture.family,
  candidateId: 'sniper:mug',
  sourceOwner: 'pupsonstuff',
  sourceProductRef: 'mug',
  sourceVariantRef: 'mug-11oz',
  skuRef: 'pupson:mug:mug-11oz',
  targetChannels: ['pupsonstuff'],
  state: 'verified',
  candidateEvidenceRefs: ['candidate:evidence'],
  bindingEvidenceRefs: ['binding:evidence'],
  observedAt: '2026-10-04T10:00:00.000Z',
  authority: 'PRODUCT_BINDING_EVIDENCE_ONLY',
  sourceAuthorityRetained: true,
  externalActionAuthorized: false,
  publishingAuthorized: false,
  purchasingAuthorized: false,
  moneyMovementAuthorized: false,
}

describe('PupsonStuff -> Search Commerce source sync', () => {
  it('projects Product Truth, observes owned-store publication, and forwards finalized SKU economics', async () => {
    const truths: SearchCommerceProductTruthSnapshot[] = []
    const publications: SearchCommerceSkuPublicationReceipt[] = []
    const settlements: SearchCommerceSellerSettlementObservation[] = []

    const dependencies: PupsonBusinessFactorySyncDependencies = {
      ventures: {
        async listVenturesForSupervisor() {
          return [{ ownerUserId: 'owner-1', venture }]
        },
        async getVentureByOpportunity() {
          return venture
        },
        async listReceipts(_owner, kind) {
          if (kind === 'product_binding') {
            return [{
              id: binding.id,
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'product_binding',
              evidenceRefs: [...binding.bindingEvidenceRefs],
              payload: { binding },
              recordedAt: binding.observedAt,
            }] as never
          }
          return []
        },
        async recordReceipt(receipt) {
          return receipt
        },
      },
      async fetchProjection() {
        return {
          sourceOwner: 'pupsonstuff',
          product: {
            productId: 'mug',
            variantId: 'mug-11oz',
            title: 'Classic White Mug',
            variantLabel: '11oz',
            productType: 'mug',
            retailPriceCents: 2200,
            baseCostCents: 800,
            currency: 'USD',
            active: true,
            certificationStatus: 'sample_verified',
            certifiedAt: '2026-09-20T00:00:00.000Z',
            provider: 'printify',
            providerVariantId: '100',
            blueprintId: '10',
            printProviderId: '20',
            printArea: 'front',
            productionLeadDays: 7,
            storefrontPresent: true,
            liveSellable: true,
            observedAt: '2026-10-04T11:00:00.000Z',
            evidenceRefs: ['pupson:catalog:mug'],
          },
          settlements: [{
            orderId: 'order-1',
            productId: 'mug',
            variantId: 'mug-11oz',
            state: 'settled',
            blockerCodes: [],
            currency: 'USD',
            grossRevenueCents: 3000,
            refundedAmountCents: 0,
            stripeFeeCents: 117,
            productCostCents: 800,
            shippingCostCents: 500,
            providerTaxCents: 100,
            costBasisComplete: true,
            transactionRefs: ['stripe-balance-transaction:txn_1'],
            evidenceRefs: ['pupson-order:order-1'],
            observedAt: '2026-10-04T12:00:00.000Z',
          }],
          settlementHoldDays: 30,
          authority: 'READ_ONLY_SOURCE_PROJECTION',
          externalActionAuthorized: false,
          publishingAuthorized: false,
          refundAuthorized: false,
          moneyMovementAuthorized: false,
        }
      },
      async recordProductTruth(input) {
        const truth = {
          ...input.productTruth,
          ventureId: venture.id,
          opportunityId: venture.opportunityId,
          family: venture.family,
          unitEconomics: {
            costCompleteness: 'partial',
            ...input.productTruth.unitEconomics,
          },
          fulfillment: input.productTruth.fulfillment ?? {
            certification: 'unknown',
            evidenceRefs: [],
          },
          policy: input.productTruth.policy ?? {
            status: 'unknown',
            evidenceRefs: [],
          },
          risk: {},
          authority: 'SEARCH_COMMERCE_PRODUCT_TRUTH_PROJECTION_ONLY',
          sourceAuthorityRetained: true,
          externalActionAuthorized: false,
          publishingAuthorized: false,
          purchasingAuthorized: false,
          moneyMovementAuthorized: false,
        } as SearchCommerceProductTruthSnapshot
        truths.push(truth)
        return truth
      },
      async recordPublication(input) {
        const publication = {
          ...input.publication,
          ventureId: venture.id,
          opportunityId: venture.opportunityId,
          family: venture.family,
          governanceRefs: input.publication.governanceRefs ?? [],
          evidenceRefs: input.publication.evidenceRefs,
          authority: 'SKU_PUBLICATION_OBSERVATION_ONLY',
          sourceAuthorityRetained: true,
          externalActionAuthorized: false,
          publishingAuthorized: false,
          purchasingAuthorized: false,
          moneyMovementAuthorized: false,
        } as SearchCommerceSkuPublicationReceipt
        publications.push(publication)
        return publication
      },
      async recordSettlement(input) {
        const settlement = {
          ...input.settlement,
          ventureId: venture.id,
          opportunityId: venture.opportunityId,
          family: venture.family,
          transactionRefs: input.settlement.transactionRefs ?? [],
          evidenceRefs: input.settlement.evidenceRefs,
          authority: 'SELLER_SETTLEMENT_OBSERVATION_ONLY',
          sourceAuthorityRetained: true,
          externalActionAuthorized: false,
          paymentAuthorized: false,
          refundAuthorized: false,
          moneyMovementAuthorized: false,
        } as SearchCommerceSellerSettlementObservation
        settlements.push(settlement)
        return {
          settlement,
          outcomeRecorded: true,
          learningRecorded: true,
          blockers: [],
        }
      },
    }

    const result = await runPupsonBusinessFactorySourceSync(
      {} as SupabaseClient,
      { dependencies },
    )

    expect(result.status).toBe('PASS')
    expect(result.productTruthRecorded).toBe(1)
    expect(result.publicationRecorded).toBe(1)
    expect(result.settlementsFinalized).toBe(1)
    expect(result.outcomesRecorded).toBe(1)
    expect(result.learningRecorded).toBe(1)
    expect(truths[0]?.sourceOwner).toBe('pupsonstuff')
    expect(publications[0]?.channel).toBe('pupsonstuff')
    expect(settlements[0]?.grossRevenue).toBe(30)
    expect(settlements[0]?.productCosts).toBe(8)
    expect(settlements[0]?.fees).toBe(1.17)
  })
})
