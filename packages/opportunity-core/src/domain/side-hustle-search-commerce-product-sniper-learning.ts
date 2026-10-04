import type { OpportunityOutcome } from './outcome.js'
import type { SideHustleExperimentEvaluation } from './side-hustle-experiment.js'
import type { SideHustleFamily } from './side-hustles.js'

export type SearchCommerceProductSniperLearningDecision =
  | 'insufficient_evidence'
  | 'reinforce'
  | 'neutral'
  | 'penalize'

export type SearchCommerceProductSniperRealizedObservation = {
  id: string
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productType: string
  marketMechanic: string
  targetChannels: readonly string[]
  outcomeId: string
  result: OpportunityOutcome['result']
  grossRevenue: number
  refunds: number
  totalCosts: number
  profit: number
  margin: number | null
  dollarsPerHour: number | null
  experimentId?: string
  experimentDecision?: SideHustleExperimentEvaluation['decision']
  observedAt: string
  evidenceRefs: readonly string[]
  transactionRefs: readonly string[]
  authority: 'PRODUCT_SNIPER_REALIZED_OBSERVATION_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export type SearchCommerceProductSniperLearningSnapshot = {
  ventureId: string
  opportunityId: string
  family: SideHustleFamily
  candidateId: string
  productType: string
  marketMechanic: string
  targetChannels: readonly string[]
  observationCount: number
  wins: number
  losses: number
  grossRevenue: number
  refunds: number
  totalCosts: number
  profit: number
  realizedMargin: number | null
  averageDollarsPerHour: number | null
  refundRate: number | null
  experimentPromotes: number
  experimentHolds: number
  experimentKills: number
  confidence: number
  scoreAdjustment: number
  decision: SearchCommerceProductSniperLearningDecision
  evidenceRefs: readonly string[]
  transactionRefs: readonly string[]
  observedThrough: string
  authority: 'PRODUCT_SNIPER_REALIZED_LEARNING_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

export function buildSearchCommerceProductSniperRealizedObservation(input: {
  ventureId: string
  family: SideHustleFamily
  candidateId: string
  productType: string
  marketMechanic: string
  targetChannels: readonly string[]
  outcome: OpportunityOutcome
  experimentEvaluation?: SideHustleExperimentEvaluation
  bindingEvidenceRefs: readonly string[]
}): SearchCommerceProductSniperRealizedObservation {
  const ventureId = requireText(input.ventureId, 'ventureId')
  const candidateId = requireText(input.candidateId, 'candidateId')
  const productType = requireText(input.productType, 'productType')
  const marketMechanic = requireText(input.marketMechanic, 'marketMechanic')
  const targetChannels = unique(input.targetChannels)
  if (!targetChannels.length) throw new Error('Product Sniper realized observation requires a target channel')
  if (input.experimentEvaluation && input.experimentEvaluation.opportunityId !== input.outcome.opportunityId) {
    throw new Error('Product Sniper experiment evaluation does not belong to outcome opportunity')
  }

  const bindingEvidenceRefs = unique(input.bindingEvidenceRefs)
  if (!bindingEvidenceRefs.length) {
    throw new Error('Product Sniper realized observation requires explicit candidate binding evidence')
  }

  const evidenceRefs = unique([
    ...bindingEvidenceRefs,
    ...input.outcome.evidenceRefs,
    ...(input.experimentEvaluation?.evidenceRefs ?? []),
  ])
  const transactionRefs = unique(input.outcome.transactionRefs ?? [])

  return Object.freeze({
    id: 'product-sniper-outcome:' + candidateId + ':' + input.outcome.id,
    ventureId,
    opportunityId: input.outcome.opportunityId,
    family: input.family,
    candidateId,
    productType,
    marketMechanic,
    targetChannels: Object.freeze(targetChannels),
    outcomeId: input.outcome.id,
    result: input.outcome.result,
    grossRevenue: input.outcome.grossRevenue,
    refunds: input.outcome.refunds,
    totalCosts: input.outcome.totalCosts,
    profit: input.outcome.profit,
    margin: input.outcome.margin,
    dollarsPerHour: input.outcome.dollarsPerHour,
    experimentId: input.experimentEvaluation?.experimentId,
    experimentDecision: input.experimentEvaluation?.decision,
    observedAt: normalizeDate(input.outcome.observedAt),
    evidenceRefs: Object.freeze(evidenceRefs),
    transactionRefs: Object.freeze(transactionRefs),
    authority: 'PRODUCT_SNIPER_REALIZED_OBSERVATION_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function buildSearchCommerceProductSniperLearningSnapshot(input: {
  observations: readonly SearchCommerceProductSniperRealizedObservation[]
}): SearchCommerceProductSniperLearningSnapshot {
  if (!input.observations.length) {
    throw new Error('Product Sniper learning requires at least one realized observation')
  }
  const observations = dedupeObservations(input.observations)
  const first = observations[0]!

  for (const observation of observations) {
    if (
      observation.ventureId !== first.ventureId
      || observation.opportunityId !== first.opportunityId
      || observation.family !== first.family
      || observation.candidateId !== first.candidateId
      || observation.productType !== first.productType
      || observation.marketMechanic !== first.marketMechanic
    ) {
      throw new Error('Product Sniper learning observations must share one candidate identity')
    }
  }

  const wins = observations.filter((item) => item.result === 'won').length
  const losses = observations.length - wins
  const grossRevenue = sum(observations.map((item) => item.grossRevenue))
  const refunds = sum(observations.map((item) => item.refunds))
  const totalCosts = sum(observations.map((item) => item.totalCosts))
  const profit = sum(observations.map((item) => item.profit))
  const realizedMargin = grossRevenue - refunds > 0
    ? round(profit / (grossRevenue - refunds))
    : null
  const hourValues = observations
    .map((item) => item.dollarsPerHour)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  const averageDollarsPerHour = hourValues.length
    ? round(sum(hourValues) / hourValues.length)
    : null
  const refundRate = grossRevenue > 0 ? round(refunds / grossRevenue) : null

  const experimentPromotes = observations.filter((item) => item.experimentDecision === 'promote').length
  const experimentHolds = observations.filter((item) => item.experimentDecision === 'hold').length
  const experimentKills = observations.filter((item) => item.experimentDecision === 'kill').length

  const confidence = learningConfidence(observations)
  const scoreAdjustment = realizedScoreAdjustment({
    observationCount: observations.length,
    wins,
    profit,
    realizedMargin,
    refundRate,
    experimentPromotes,
    experimentKills,
    confidence,
  })
  const decision = learningDecision(observations.length, confidence, scoreAdjustment)

  return Object.freeze({
    ventureId: first.ventureId,
    opportunityId: first.opportunityId,
    family: first.family,
    candidateId: first.candidateId,
    productType: first.productType,
    marketMechanic: first.marketMechanic,
    targetChannels: Object.freeze(unique(observations.flatMap((item) => item.targetChannels))),
    observationCount: observations.length,
    wins,
    losses,
    grossRevenue: round(grossRevenue),
    refunds: round(refunds),
    totalCosts: round(totalCosts),
    profit: round(profit),
    realizedMargin,
    averageDollarsPerHour,
    refundRate,
    experimentPromotes,
    experimentHolds,
    experimentKills,
    confidence,
    scoreAdjustment,
    decision,
    evidenceRefs: Object.freeze(unique(observations.flatMap((item) => item.evidenceRefs))),
    transactionRefs: Object.freeze(unique(observations.flatMap((item) => item.transactionRefs))),
    observedThrough: latestObservedAt(observations),
    authority: 'PRODUCT_SNIPER_REALIZED_LEARNING_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

function learningConfidence(
  observations: readonly SearchCommerceProductSniperRealizedObservation[],
): number {
  const countScore = Math.min(1, observations.length / 5)
  const transactionCoverage = observations.filter((item) => item.transactionRefs.length > 0).length / observations.length
  const experimentCoverage = observations.filter((item) => Boolean(item.experimentDecision)).length / observations.length
  return round(Math.min(1, countScore * 0.55 + transactionCoverage * 0.3 + experimentCoverage * 0.15))
}

function realizedScoreAdjustment(input: {
  observationCount: number
  wins: number
  profit: number
  realizedMargin: number | null
  refundRate: number | null
  experimentPromotes: number
  experimentKills: number
  confidence: number
}): number {
  if (input.observationCount < 3 || input.confidence < 0.45) return 0

  const winRate = input.wins / input.observationCount
  const winComponent = (winRate - 0.5) * 8
  const marginComponent = input.realizedMargin === null
    ? 0
    : clamp(input.realizedMargin, -1, 1) * 4
  const profitComponent = input.profit > 0 ? 1.5 : input.profit < 0 ? -2.5 : 0
  const refundComponent = input.refundRate === null
    ? 0
    : -clamp(input.refundRate / 0.25, 0, 1) * 2
  const experimentComponent = clamp(
    (input.experimentPromotes - input.experimentKills) / input.observationCount,
    -1,
    1,
  ) * 2

  return round(clamp(
    (winComponent + marginComponent + profitComponent + refundComponent + experimentComponent)
      * input.confidence,
    -10,
    10,
  ))
}

function learningDecision(
  observationCount: number,
  confidence: number,
  adjustment: number,
): SearchCommerceProductSniperLearningDecision {
  if (observationCount < 3 || confidence < 0.45) return 'insufficient_evidence'
  if (adjustment >= 2) return 'reinforce'
  if (adjustment <= -2) return 'penalize'
  return 'neutral'
}

function dedupeObservations(
  observations: readonly SearchCommerceProductSniperRealizedObservation[],
): SearchCommerceProductSniperRealizedObservation[] {
  const byOutcome = new Map<string, SearchCommerceProductSniperRealizedObservation>()
  for (const observation of observations) {
    const prior = byOutcome.get(observation.outcomeId)
    if (!prior || Date.parse(observation.observedAt) >= Date.parse(prior.observedAt)) {
      byOutcome.set(observation.outcomeId, observation)
    }
  }
  return [...byOutcome.values()].sort((a, b) =>
    Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id.localeCompare(b.id),
  )
}

function latestObservedAt(
  observations: readonly SearchCommerceProductSniperRealizedObservation[],
): string {
  const ordered = observations.map((item) => item.observedAt).sort()
  return ordered[ordered.length - 1]!
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Product Sniper realized observation date must be valid')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('Product Sniper realized ' + field + ' is required')
  return normalized
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}


export function isSearchCommerceProductSniperLearningSnapshot(
  value: unknown,
): value is SearchCommerceProductSniperLearningSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.candidateId === 'string'
    && typeof record.productType === 'string'
    && typeof record.marketMechanic === 'string'
    && Array.isArray(record.targetChannels)
    && typeof record.observationCount === 'number'
    && typeof record.profit === 'number'
    && typeof record.confidence === 'number'
    && typeof record.scoreAdjustment === 'number'
    && ['insufficient_evidence', 'reinforce', 'neutral', 'penalize'].includes(String(record.decision))
    && Array.isArray(record.evidenceRefs)
    && Array.isArray(record.transactionRefs)
    && typeof record.observedThrough === 'string'
    && record.authority === 'PRODUCT_SNIPER_REALIZED_LEARNING_ONLY'
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}

export function isSearchCommerceProductSniperRealizedObservation(
  value: unknown,
): value is SearchCommerceProductSniperRealizedObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.ventureId === 'string'
    && typeof record.opportunityId === 'string'
    && typeof record.family === 'string'
    && typeof record.candidateId === 'string'
    && typeof record.productType === 'string'
    && typeof record.marketMechanic === 'string'
    && Array.isArray(record.targetChannels)
    && typeof record.outcomeId === 'string'
    && (record.result === 'won' || record.result === 'lost')
    && typeof record.grossRevenue === 'number'
    && typeof record.refunds === 'number'
    && typeof record.totalCosts === 'number'
    && typeof record.profit === 'number'
    && typeof record.observedAt === 'string'
    && Array.isArray(record.evidenceRefs)
    && Array.isArray(record.transactionRefs)
    && record.authority === 'PRODUCT_SNIPER_REALIZED_OBSERVATION_ONLY'
    && record.externalActionAuthorized === false
    && record.publishingAuthorized === false
    && record.purchasingAuthorized === false
    && record.moneyMovementAuthorized === false
}
