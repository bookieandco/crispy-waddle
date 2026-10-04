import {
  assessVentureOriginality,
  type VentureOriginalityAssessment,
  type VentureWorkItem,
} from './venture-factory.js'
import {
  isSearchCommerceFamily,
} from './side-hustle-search-commerce-operations.js'
import type { SideHustleFamily } from './side-hustles.js'
import type { SearchCommerceProductSniperLearningSnapshot } from './side-hustle-search-commerce-product-sniper-learning.js'

export type SearchCommerceProductSniperSignalKind =
  | 'demand'
  | 'buyer_intent'
  | 'competition_headroom'
  | 'margin_potential'
  | 'differentiation'
  | 'channel_fit'
  | 'automation_potential'
  | 'repeatability'
  | 'seasonal_fit'
  | 'platform_risk'
  | 'fulfillment_complexity'
  | 'capital_risk'

export type SearchCommerceProductSniperSignal = {
  id: string
  kind: SearchCommerceProductSniperSignalKind
  score: number
  confidence: number
  sourceRef: string
  observedAt: string
  note: string
}

export type SearchCommerceSeasonalWindow = {
  eventId: string
  eventDate: string
  creativeLeadDays: number
  productionLeadDays: number
  indexingLeadDays: number
  shippingBufferDays: number
  validationLeadDays: number
  evidenceRefs: readonly string[]
}

export type SearchCommercePublishRunway = {
  eventId: string
  eventDate: string
  publishBy: string
  totalLeadDays: number
  daysUntilPublishBy: number
  status: 'open' | 'publish_by_passed'
  evidenceRefs: readonly string[]
}

export type SearchCommerceProductSniperCandidateInput = {
  id: string
  ventureId: string
  family: SideHustleFamily
  title: string
  productType: string
  buyer: string
  marketMechanic: string
  originalConcept: string
  targetChannels: readonly string[]
  signals: readonly SearchCommerceProductSniperSignal[]
  competitorArtifactRefs?: readonly string[]
  protectedTerms?: readonly string[]
  protectedCharacters?: readonly string[]
  copiedPhrases?: readonly string[]
  intentionalStyleClone?: boolean
  originalityEvidenceRefs: readonly string[]
  seasonalWindow?: SearchCommerceSeasonalWindow
  learningSnapshot?: SearchCommerceProductSniperLearningSnapshot
  evaluatedAt: string
}

export type SearchCommerceProductSniperFactors = {
  demand: number
  buyerIntent: number
  competitionHeadroom: number
  marginPotential: number
  differentiation: number
  channelFit: number
  automationPotential: number
  repeatability: number
  seasonalFit: number
  evidenceQuality: number
  platformSafety: number
  fulfillmentEase: number
  capitalEfficiency: number
}

export type SearchCommerceProductSniperCandidate = {
  id: string
  ventureId: string
  family: SideHustleFamily
  title: string
  productType: string
  buyer: string
  marketMechanic: string
  originalConcept: string
  targetChannels: readonly string[]
  baseScore: number
  realizedLearningAdjustment: number
  score: number
  factors: SearchCommerceProductSniperFactors
  recommendation: 'research' | 'hold' | 'reject'
  blockers: readonly string[]
  reasons: readonly string[]
  signalIds: readonly string[]
  evidenceRefs: readonly string[]
  originality: VentureOriginalityAssessment
  learningDecision?: SearchCommerceProductSniperLearningSnapshot['decision']
  publishRunway?: SearchCommercePublishRunway
  evaluatedAt: string
  authority: 'PRODUCT_SNIPER_RESEARCH_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
  directCreativeReplicationAuthorized: false
}

export type SearchCommerceProductSniperReport = {
  ventureId: string
  family: SideHustleFamily
  evaluatedAt: string
  candidates: readonly SearchCommerceProductSniperCandidate[]
  researchQueue: readonly SearchCommerceProductSniperCandidate[]
  holdQueue: readonly SearchCommerceProductSniperCandidate[]
  rejected: readonly SearchCommerceProductSniperCandidate[]
  evidenceRefs: readonly string[]
  authority: 'PRODUCT_SNIPER_PORTFOLIO_ANALYTICS_ONLY'
  externalActionAuthorized: false
  publishingAuthorized: false
  purchasingAuthorized: false
  moneyMovementAuthorized: false
}

const REQUIRED_SIGNAL_KINDS: readonly SearchCommerceProductSniperSignalKind[] = [
  'demand',
  'buyer_intent',
  'competition_headroom',
  'margin_potential',
  'channel_fit',
]

const POSITIVE_WEIGHTS: Readonly<Record<
  Exclude<keyof SearchCommerceProductSniperFactors, 'platformSafety' | 'fulfillmentEase' | 'capitalEfficiency'>,
  number
>> = Object.freeze({
  demand: 0.15,
  buyerIntent: 0.10,
  competitionHeadroom: 0.08,
  marginPotential: 0.10,
  differentiation: 0.10,
  channelFit: 0.07,
  automationPotential: 0.05,
  repeatability: 0.04,
  seasonalFit: 0.04,
  evidenceQuality: 0.12,
})

const SAFETY_WEIGHTS = Object.freeze({
  platformSafety: 0.05,
  fulfillmentEase: 0.05,
  capitalEfficiency: 0.05,
})

export function scoreSearchCommerceProductCandidate(
  input: SearchCommerceProductSniperCandidateInput,
): SearchCommerceProductSniperCandidate {
  const evaluatedAt = normalizeDate(input.evaluatedAt)
  requireText(input.id, 'productSniper.id')
  requireText(input.ventureId, 'productSniper.ventureId')
  requireText(input.title, 'productSniper.title')
  requireText(input.productType, 'productSniper.productType')
  requireText(input.buyer, 'productSniper.buyer')
  requireText(input.marketMechanic, 'productSniper.marketMechanic')
  requireText(input.originalConcept, 'productSniper.originalConcept')
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Product Sniper is only registered for Search Commerce families')
  }
  if (input.targetChannels.length === 0) {
    throw new Error('Product Sniper requires at least one target channel')
  }
  if (input.signals.length === 0) {
    throw new Error('Product Sniper requires evidence-backed signals')
  }

  const signals = dedupeSignals(input.signals)
  signals.forEach(validateSignal)
  const originality = assessVentureOriginality({
    marketMechanics: [input.marketMechanic],
    competitorArtifactRefs: unique(input.competitorArtifactRefs ?? []),
    proposedCreative: input.originalConcept,
    protectedTerms: unique(input.protectedTerms ?? []),
    protectedCharacters: unique(input.protectedCharacters ?? []),
    copiedPhrases: unique(input.copiedPhrases ?? []),
    intentionalStyleClone: input.intentionalStyleClone,
    evidenceRefs: unique(input.originalityEvidenceRefs),
  })

  const publishRunway = input.seasonalWindow
    ? buildSearchCommercePublishRunway(input.seasonalWindow, evaluatedAt)
    : undefined

  const byKind = groupSignals(signals)
  const factors: SearchCommerceProductSniperFactors = Object.freeze({
    demand: aggregateSignal(byKind.get('demand')),
    buyerIntent: aggregateSignal(byKind.get('buyer_intent')),
    competitionHeadroom: aggregateSignal(byKind.get('competition_headroom')),
    marginPotential: aggregateSignal(byKind.get('margin_potential')),
    differentiation: aggregateSignal(byKind.get('differentiation')),
    channelFit: aggregateSignal(byKind.get('channel_fit')),
    automationPotential: aggregateSignal(byKind.get('automation_potential')),
    repeatability: aggregateSignal(byKind.get('repeatability')),
    seasonalFit: input.seasonalWindow
      ? aggregateSignal(byKind.get('seasonal_fit'))
      : 100,
    evidenceQuality: evidenceQuality(signals, evaluatedAt),
    platformSafety: inverseRisk(byKind.get('platform_risk')),
    fulfillmentEase: inverseRisk(byKind.get('fulfillment_complexity')),
    capitalEfficiency: inverseRisk(byKind.get('capital_risk')),
  })

  let baseScore = 0
  for (const [key, weight] of Object.entries(POSITIVE_WEIGHTS) as Array<
    [keyof typeof POSITIVE_WEIGHTS, number]
  >) {
    baseScore += factors[key] * weight
  }
  for (const [key, weight] of Object.entries(SAFETY_WEIGHTS) as Array<
    [keyof typeof SAFETY_WEIGHTS, number]
  >) {
    baseScore += factors[key] * weight
  }
  baseScore = round(baseScore)

  const learning = input.learningSnapshot
  if (learning && (
    learning.ventureId !== input.ventureId
    || learning.family !== input.family
    || learning.candidateId !== input.id
    || learning.productType !== input.productType
    || learning.marketMechanic !== input.marketMechanic
  )) {
    throw new Error('Product Sniper learning snapshot does not match candidate identity')
  }
  const realizedLearningAdjustment = learning?.scoreAdjustment ?? 0
  const score = round(clamp(baseScore + realizedLearningAdjustment, 0, 100))

  const blockers: string[] = []
  const kinds = new Set(signals.map((signal) => signal.kind))
  for (const kind of REQUIRED_SIGNAL_KINDS) {
    if (!kinds.has(kind)) blockers.push('Missing required evidence signal: ' + kind + '.')
  }
  if (sourceDiversity(signals) < 2) {
    blockers.push('Product candidate evidence lacks source diversity.')
  }
  if (factors.evidenceQuality < 60) {
    blockers.push('Product candidate evidence quality is below 60.')
  }
  if (originality.decision !== 'pass') {
    blockers.push('Originality/IP assessment blocked the proposed concept.')
  }
  if (publishRunway?.status === 'publish_by_passed') {
    blockers.push('Seasonal publish-by date has passed for this cycle.')
  }

  const hardReject = originality.decision !== 'pass'
  const missingRequiredEvidence = blockers.some((blocker) =>
    blocker.startsWith('Missing required evidence signal:')
  )
  const recommendation: SearchCommerceProductSniperCandidate['recommendation'] =
    hardReject
      ? 'reject'
      : missingRequiredEvidence
        ? 'hold'
        : score < 50
          ? 'reject'
          : blockers.length === 0 && score >= 70
            ? 'research'
            : 'hold'

  const evidenceRefs = unique([
    ...signals.map((signal) => signal.sourceRef),
    ...input.originalityEvidenceRefs,
    ...(input.seasonalWindow?.evidenceRefs ?? []),
    ...originality.evidenceRefs,
    ...(learning?.evidenceRefs ?? []),
  ])

  return Object.freeze({
    id: input.id.trim(),
    ventureId: input.ventureId.trim(),
    family: input.family,
    title: input.title.trim(),
    productType: input.productType.trim(),
    buyer: input.buyer.trim(),
    marketMechanic: input.marketMechanic.trim(),
    originalConcept: input.originalConcept.trim(),
    targetChannels: Object.freeze(unique(input.targetChannels)),
    baseScore,
    realizedLearningAdjustment,
    score,
    factors,
    recommendation,
    blockers: Object.freeze(unique(blockers)),
    reasons: Object.freeze([
      'demand=' + factors.demand,
      'buyer_intent=' + factors.buyerIntent,
      'competition_headroom=' + factors.competitionHeadroom,
      'margin_potential=' + factors.marginPotential,
      'differentiation=' + factors.differentiation,
      'channel_fit=' + factors.channelFit,
      'evidence_quality=' + factors.evidenceQuality,
      'platform_safety=' + factors.platformSafety,
      'base_score=' + baseScore,
      'realized_learning_adjustment=' + realizedLearningAdjustment,
      ...(learning ? ['realized_learning=' + learning.decision, 'realized_observations=' + learning.observationCount] : []),
      ...(publishRunway
        ? ['publish_by=' + publishRunway.publishBy, 'runway_days=' + publishRunway.daysUntilPublishBy]
        : ['seasonality=evergreen_or_unspecified']),
    ]),
    signalIds: Object.freeze(signals.map((signal) => signal.id)),
    evidenceRefs: Object.freeze(evidenceRefs),
    originality,
    learningDecision: learning?.decision,
    publishRunway,
    evaluatedAt,
    authority: 'PRODUCT_SNIPER_RESEARCH_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
    directCreativeReplicationAuthorized: false,
  })
}

export function rankSearchCommerceProductCandidates(input: {
  ventureId: string
  family: SideHustleFamily
  candidates: readonly SearchCommerceProductSniperCandidateInput[]
  evaluatedAt: string
}): SearchCommerceProductSniperReport {
  const ventureId = requireText(input.ventureId, 'productSniper.ventureId')
  const evaluatedAt = normalizeDate(input.evaluatedAt)
  if (!isSearchCommerceFamily(input.family)) {
    throw new Error('Product Sniper is only registered for Search Commerce families')
  }

  const candidates = input.candidates.map((candidate) => {
    if (candidate.ventureId !== ventureId || candidate.family !== input.family) {
      throw new Error('Product Sniper candidate does not belong to the requested venture/family')
    }
    return scoreSearchCommerceProductCandidate({ ...candidate, evaluatedAt })
  }).sort(compareCandidates)

  return Object.freeze({
    ventureId,
    family: input.family,
    evaluatedAt,
    candidates: Object.freeze(candidates),
    researchQueue: Object.freeze(candidates.filter((candidate) => candidate.recommendation === 'research')),
    holdQueue: Object.freeze(candidates.filter((candidate) => candidate.recommendation === 'hold')),
    rejected: Object.freeze(candidates.filter((candidate) => candidate.recommendation === 'reject')),
    evidenceRefs: Object.freeze(unique(candidates.flatMap((candidate) => candidate.evidenceRefs))),
    authority: 'PRODUCT_SNIPER_PORTFOLIO_ANALYTICS_ONLY',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    purchasingAuthorized: false,
    moneyMovementAuthorized: false,
  })
}

export function projectProductSniperResearchWork(input: {
  report: SearchCommerceProductSniperReport
  observedAt: string
}): readonly VentureWorkItem[] {
  const observedAt = normalizeDate(input.observedAt)
  return Object.freeze(input.report.researchQueue.map((candidate) => Object.freeze({
    id: 'product-sniper-work:' + input.report.ventureId + ':' + candidate.id,
    ventureId: input.report.ventureId,
    agentId: 'delia:strategy',
    step: 'product_sniper:research:' + candidate.id,
    status: 'queued' as const,
    createdAt: observedAt,
    updatedAt: observedAt,
    evidenceRefs: [...candidate.evidenceRefs],
    outputRefs: [],
    spendUsd: 0,
    authorizationEffect: 'NONE' as const,
  })))
}

export function buildSearchCommercePublishRunway(
  input: SearchCommerceSeasonalWindow,
  evaluatedAt: string,
): SearchCommercePublishRunway {
  const evaluated = normalizeDate(evaluatedAt)
  const eventDate = normalizeBusinessDate(input.eventDate, 'seasonalWindow.eventDate')
  const evidenceRefs = unique(input.evidenceRefs)
  if (!evidenceRefs.length) throw new Error('Seasonal window requires evidence references')
  const components = [
    input.creativeLeadDays,
    input.productionLeadDays,
    input.indexingLeadDays,
    input.shippingBufferDays,
    input.validationLeadDays,
  ]
  components.forEach((value, index) => requireNonNegativeInteger(value, 'seasonalWindow.leadDays[' + index + ']'))
  const totalLeadDays = components.reduce((sum, value) => sum + value, 0)
  const publishByDate = new Date(eventDate + 'T00:00:00.000Z')
  publishByDate.setUTCDate(publishByDate.getUTCDate() - totalLeadDays)
  const publishBy = publishByDate.toISOString().slice(0, 10)
  const evaluatedDate = evaluated.slice(0, 10)
  const daysUntilPublishBy = Math.floor(
    (Date.parse(publishBy + 'T00:00:00.000Z') - Date.parse(evaluatedDate + 'T00:00:00.000Z'))
    / 86_400_000,
  )

  return Object.freeze({
    eventId: requireText(input.eventId, 'seasonalWindow.eventId'),
    eventDate,
    publishBy,
    totalLeadDays,
    daysUntilPublishBy,
    status: daysUntilPublishBy < 0 ? 'publish_by_passed' : 'open',
    evidenceRefs: Object.freeze(evidenceRefs),
  })
}

function compareCandidates(
  a: SearchCommerceProductSniperCandidate,
  b: SearchCommerceProductSniperCandidate,
): number {
  const rec = recommendationRank(b.recommendation) - recommendationRank(a.recommendation)
  if (rec !== 0) return rec
  const score = b.score - a.score
  if (score !== 0) return score

  const aRunway = a.publishRunway?.daysUntilPublishBy ?? Number.POSITIVE_INFINITY
  const bRunway = b.publishRunway?.daysUntilPublishBy ?? Number.POSITIVE_INFINITY
  if (aRunway !== bRunway) return aRunway - bRunway
  return a.id.localeCompare(b.id)
}

function recommendationRank(value: SearchCommerceProductSniperCandidate['recommendation']): number {
  switch (value) {
    case 'research': return 3
    case 'hold': return 2
    case 'reject': return 1
  }
}

function groupSignals(
  signals: readonly SearchCommerceProductSniperSignal[],
): Map<SearchCommerceProductSniperSignalKind, SearchCommerceProductSniperSignal[]> {
  const grouped = new Map<SearchCommerceProductSniperSignalKind, SearchCommerceProductSniperSignal[]>()
  for (const signal of signals) {
    const bucket = grouped.get(signal.kind) ?? []
    bucket.push(signal)
    grouped.set(signal.kind, bucket)
  }
  return grouped
}

function aggregateSignal(signals?: readonly SearchCommerceProductSniperSignal[]): number {
  if (!signals?.length) return 0
  const totalConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0)
  if (totalConfidence === 0) return round(signals.reduce((sum, signal) => sum + signal.score, 0) / signals.length)
  return round(
    signals.reduce((sum, signal) => sum + signal.score * signal.confidence, 0)
    / totalConfidence,
  )
}

function inverseRisk(signals?: readonly SearchCommerceProductSniperSignal[]): number {
  if (!signals?.length) return 50
  return round(100 - aggregateSignal(signals))
}

function evidenceQuality(
  signals: readonly SearchCommerceProductSniperSignal[],
  evaluatedAt: string,
): number {
  const avgConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length * 100
  const diversity = Math.min(100, sourceDiversity(signals) / 3 * 100)
  const recency = averageRecencyScore(signals, evaluatedAt)
  return round(avgConfidence * 0.5 + diversity * 0.25 + recency * 0.25)
}

function averageRecencyScore(
  signals: readonly SearchCommerceProductSniperSignal[],
  evaluatedAt: string,
): number {
  const now = Date.parse(evaluatedAt)
  const scores = signals.map((signal) => {
    const ageDays = Math.max(0, (now - Date.parse(signal.observedAt)) / 86_400_000)
    if (ageDays <= 7) return 100
    if (ageDays <= 30) return 85
    if (ageDays <= 60) return 65
    if (ageDays <= 120) return 45
    return 20
  })
  return round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function sourceDiversity(signals: readonly SearchCommerceProductSniperSignal[]): number {
  return new Set(signals.map((signal) => sourceIdentity(signal.sourceRef))).size
}

function sourceIdentity(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

function dedupeSignals(
  signals: readonly SearchCommerceProductSniperSignal[],
): SearchCommerceProductSniperSignal[] {
  const byId = new Map<string, SearchCommerceProductSniperSignal>()
  for (const signal of signals) {
    const prior = byId.get(signal.id)
    if (!prior || Date.parse(signal.observedAt) >= Date.parse(prior.observedAt)) {
      byId.set(signal.id, { ...signal })
    }
  }
  return [...byId.values()].sort((a, b) =>
    Date.parse(b.observedAt) - Date.parse(a.observedAt) || a.id.localeCompare(b.id),
  )
}

function validateSignal(signal: SearchCommerceProductSniperSignal): void {
  requireText(signal.id, 'productSniper.signal.id')
  requireText(signal.sourceRef, 'productSniper.signal.sourceRef')
  requireText(signal.note, 'productSniper.signal.note')
  normalizeDate(signal.observedAt)
  requireScore(signal.score, 'productSniper.signal.score')
  if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1) {
    throw new Error('productSniper.signal.confidence must be between 0 and 1')
  }
}

function requireScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(field + ' must be between 0 and 100')
  }
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(field + ' must be a non-negative integer')
  }
}

function normalizeBusinessDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(field + ' must use YYYY-MM-DD')
  const parsed = Date.parse(value + 'T00:00:00.000Z')
  const normalized = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : ''
  if (normalized !== value) throw new Error(field + ' must be a valid calendar date')
  return value
}

function normalizeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Product Sniper evaluatedAt/observedAt must be a valid date')
  return new Date(parsed).toISOString()
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(field + ' is required')
  return normalized
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
