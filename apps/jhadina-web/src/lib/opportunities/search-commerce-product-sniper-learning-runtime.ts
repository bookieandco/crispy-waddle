import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceProductSniperLearningSnapshot,
  buildSearchCommerceProductSniperRealizedObservation,
  evaluateSideHustleExperiment,
  isSearchCommerceFamily,
  isSearchCommerceSellerSettlementObservation,
  isSearchCommerceSkuPublicationReceipt,
  isSearchCommerceProductSniperRealizedObservation,
  type OpportunityOutcome,
  type SearchCommerceProductSniperLearningSnapshot,
  type SideHustleExperiment,
  type SideHustleExperimentEvaluation,
  type SideHustleExperimentObservation,
} from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

type OutcomeRow = { payload: OpportunityOutcome }
type ExperimentRow = { payload: SideHustleExperiment }
type ObservationRow = { payload: SideHustleExperimentObservation }

export type SearchCommerceProductSniperLearningRepository = Pick<
  VentureRuntimeRepository,
  'getVentureByOpportunity' | 'listReceipts' | 'recordReceipt'
>

export type SearchCommerceProductSniperLearningEvidenceRepository = {
  getOutcome(opportunityId: string, outcomeId: string): Promise<OpportunityOutcome | undefined>
  getExperimentEvaluation(
    opportunityId: string,
    experimentId: string,
    evaluatedAt: string,
  ): Promise<SideHustleExperimentEvaluation | undefined>
}

export type SearchCommerceProductSniperLearningDependencies = {
  ventures: SearchCommerceProductSniperLearningRepository
  evidence: SearchCommerceProductSniperLearningEvidenceRepository
}

class SupabaseSearchCommerceProductSniperLearningEvidence
implements SearchCommerceProductSniperLearningEvidenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getOutcome(opportunityId: string, outcomeId: string): Promise<OpportunityOutcome | undefined> {
    const { data, error } = await this.client
      .from('jhadina_opportunity_outcomes')
      .select('payload')
      .eq('opportunity_id', opportunityId)
      .eq('id', outcomeId)
      .maybeSingle<OutcomeRow>()
    if (error) throw new Error('PRODUCT_SNIPER_LEARNING_OUTCOME_READ_FAILED:' + error.message)
    return data?.payload
  }

  async getExperimentEvaluation(
    opportunityId: string,
    experimentId: string,
    evaluatedAt: string,
  ): Promise<SideHustleExperimentEvaluation | undefined> {
    const [{ data: experimentRow, error: experimentError }, { data: observationRows, error: observationError }] =
      await Promise.all([
        this.client
          .from('jhadina_side_hustle_experiments')
          .select('payload')
          .eq('opportunity_id', opportunityId)
          .eq('id', experimentId)
          .maybeSingle<ExperimentRow>(),
        this.client
          .from('jhadina_side_hustle_experiment_observations')
          .select('payload')
          .eq('opportunity_id', opportunityId)
          .order('observed_at', { ascending: true })
          .returns<ObservationRow[]>(),
      ])

    if (experimentError) {
      throw new Error('PRODUCT_SNIPER_LEARNING_EXPERIMENT_READ_FAILED:' + experimentError.message)
    }
    if (observationError) {
      throw new Error('PRODUCT_SNIPER_LEARNING_OBSERVATION_READ_FAILED:' + observationError.message)
    }
    const experiment = experimentRow?.payload
    if (!experiment) return undefined
    if (experiment.status !== 'completed') {
      throw new Error('PRODUCT_SNIPER_LEARNING_EXPERIMENT_NOT_COMPLETED')
    }
    const observations = (observationRows ?? [])
      .map((row) => row.payload)
      .filter((observation) => observation.experimentId === experiment.id)

    return evaluateSideHustleExperiment({
      experiment,
      observations,
      evaluatedAt,
    })
  }
}

export async function recordSearchCommerceProductSniperOutcomeLearning(
  client: SupabaseClient,
  input: {
    ownerUserId: string
    opportunityId: string
    candidateId: string
    productType: string
    marketMechanic: string
    targetChannels: readonly string[]
    outcomeId: string
    experimentId?: string
    observedAt?: string
    dependencies?: SearchCommerceProductSniperLearningDependencies
  },
): Promise<SearchCommerceProductSniperLearningSnapshot> {
  const ownerUserId = requireText(input.ownerUserId, 'owner')
  const opportunityId = requireText(input.opportunityId, 'opportunity')
  const candidateId = requireText(input.candidateId, 'candidate')
  const outcomeId = requireText(input.outcomeId, 'outcome')
  const observedAt = normalizeDate(input.observedAt ?? new Date().toISOString())
  const dependencies = input.dependencies ?? {
    ventures: new VentureRuntimeRepository(client),
    evidence: new SupabaseSearchCommerceProductSniperLearningEvidence(client),
  }

  const venture = await dependencies.ventures.getVentureByOpportunity(ownerUserId, opportunityId)
  if (!venture) throw new Error('PRODUCT_SNIPER_LEARNING_VENTURE_NOT_FOUND')
  if (!isSearchCommerceFamily(venture.family)) {
    throw new Error('PRODUCT_SNIPER_LEARNING_FAMILY_NOT_SUPPORTED')
  }

  const [outcome, experimentEvaluation, priorReceipts, lineageReceipts] = await Promise.all([
    dependencies.evidence.getOutcome(opportunityId, outcomeId),
    input.experimentId
      ? dependencies.evidence.getExperimentEvaluation(
          opportunityId,
          requireText(input.experimentId, 'experiment'),
          observedAt,
        )
      : Promise.resolve(undefined),
    dependencies.ventures.listReceipts(ownerUserId, 'product_sniper_learning'),
    dependencies.ventures.listReceipts(ownerUserId, 'seller_settlement'),
  ])
  if (!outcome) throw new Error('PRODUCT_SNIPER_LEARNING_OUTCOME_NOT_FOUND')
  if (outcome.opportunityId !== opportunityId) {
    throw new Error('PRODUCT_SNIPER_LEARNING_OUTCOME_OPPORTUNITY_MISMATCH')
  }
  if (input.experimentId && !experimentEvaluation) {
    throw new Error('PRODUCT_SNIPER_LEARNING_EXPERIMENT_NOT_FOUND')
  }

  const matchingSettlement = lineageReceipts
    .filter((receipt) => receipt.ventureId === venture.id)
    .map((receipt) => receipt.payload.settlement)
    .filter(isSearchCommerceSellerSettlementObservation)
    .filter((settlement) => settlement.state === 'settled')
    .filter((settlement) => settlement.scope === 'sku')
    .filter((settlement) => settlement.candidateId === candidateId)
    .filter((settlement) => settlement.opportunityId === opportunityId)
    .filter((settlement) => overlaps(settlement.transactionRefs, outcome.transactionRefs ?? []))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]

  if (!matchingSettlement || !matchingSettlement.productRef || !matchingSettlement.skuRef) {
    throw new Error('PRODUCT_SNIPER_LEARNING_SELLER_SETTLEMENT_REQUIRED')
  }

  const publicationReceipts = await dependencies.ventures.listReceipts(ownerUserId, 'sku_publication')
  const matchingPublication = publicationReceipts
    .filter((receipt) => receipt.ventureId === venture.id)
    .map((receipt) => receipt.payload.receipt)
    .filter(isSearchCommerceSkuPublicationReceipt)
    .filter((receipt) => receipt.state === 'published')
    .filter((receipt) => receipt.candidateId === candidateId)
    .filter((receipt) => receipt.productRef === matchingSettlement.productRef)
    .filter((receipt) => receipt.skuRef === matchingSettlement.skuRef)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]

  if (!matchingPublication) {
    throw new Error('PRODUCT_SNIPER_LEARNING_SKU_PUBLICATION_REQUIRED')
  }

  const observation = buildSearchCommerceProductSniperRealizedObservation({
    ventureId: venture.id,
    family: venture.family,
    candidateId,
    productType: input.productType,
    marketMechanic: input.marketMechanic,
    targetChannels: input.targetChannels,
    outcome,
    experimentEvaluation,
    bindingEvidenceRefs: [
      ...matchingSettlement.evidenceRefs,
      ...matchingPublication.evidenceRefs,
      'seller-settlement:' + matchingSettlement.id,
      'sku-publication:' + matchingPublication.id,
    ],
  })

  const prior = priorReceipts
    .filter((receipt) => receipt.ventureId === venture.id)
    .map((receipt) => receipt.payload.observation)
    .filter(isSearchCommerceProductSniperRealizedObservation)
    .filter((item) => item.candidateId === candidateId)

  const snapshot = buildSearchCommerceProductSniperLearningSnapshot({
    observations: [...prior, observation],
  })

  await dependencies.ventures.recordReceipt({
    id: 'product-sniper-learning:' + venture.id + ':' + candidateId + ':' + outcome.id,
    ownerUserId,
    ventureId: venture.id,
    kind: 'product_sniper_learning',
    evidenceRefs: [...snapshot.evidenceRefs],
    payload: {
      opportunityId,
      candidateId,
      outcomeId: outcome.id,
      sellerSettlementId: matchingSettlement.id,
      skuPublicationId: matchingPublication.id,
      observation,
      snapshot,
      authority: snapshot.authority,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
    recordedAt: observedAt,
  })

  return snapshot
}

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  const right = new Set(b.map((value) => value.trim()).filter(Boolean))
  return a.some((value) => right.has(value.trim()))
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('PRODUCT_SNIPER_LEARNING_TIME_INVALID')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('PRODUCT_SNIPER_LEARNING_' + field.toUpperCase() + '_REQUIRED')
  return normalized
}
