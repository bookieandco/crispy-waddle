export const MARKET_IQ_SCHEMA_VERSION = 'MARKET-IQ-1' as const

export type MarketDomain =
  | 'MEME_COIN'
  | 'PREDICTION'
  | 'SPORTS'
  | 'STOCK'
  | 'CRYPTO'
  | 'FOREX'
  | 'PRECIOUS_METAL'

export type MarketValueKind = 'PRICE' | 'PROBABILITY' | 'ODDS' | 'RETURN' | 'FLOW' | 'SENTIMENT'

export type MarketObservation = Readonly<{
  schemaVersion: typeof MARKET_IQ_SCHEMA_VERSION
  observationId: string
  domain: MarketDomain
  subjectId: string
  venue: string
  valueKind: MarketValueKind
  observedValue: number
  observedAt: string
  availableAt: string
  informationCutoff: string
  liquidity?: number
  spread?: number
  actorId?: string
  clusterId?: string
  evidenceRefs: readonly string[]
  provenanceHash: string
  authority: 'INTELLIGENCE_ONLY'
  canAuthorizeTrade: false
}>

const nonEmpty = (value: string, code: string): void => {
  if (!value.trim()) throw new Error(code)
}

const finite = (value: number, code: string): void => {
  if (!Number.isFinite(value)) throw new Error(code)
}

const unit = (value: number, code: string): void => {
  finite(value, code)
  if (value < 0 || value > 1) throw new Error(code)
}

const positive = (value: number, code: string): void => {
  finite(value, code)
  if (value <= 0) throw new Error(code)
}

const nonNegative = (value: number | undefined, code: string): void => {
  if (value === undefined) return
  finite(value, code)
  if (value < 0) throw new Error(code)
}

const timestamp = (value: string, code: string): number => {
  nonEmpty(value, code)
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) throw new Error(code)
  return parsed
}

const unique = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values.filter((value) => value.trim()))].sort())

const round = (value: number): number => Math.round(value * 1_000_000_000) / 1_000_000_000

export function createMarketObservation(
  input: Omit<MarketObservation, 'schemaVersion' | 'authority' | 'canAuthorizeTrade'>,
): MarketObservation {
  nonEmpty(input.observationId, 'MARKET_IQ_OBSERVATION_ID_REQUIRED')
  nonEmpty(input.subjectId, 'MARKET_IQ_SUBJECT_ID_REQUIRED')
  nonEmpty(input.venue, 'MARKET_IQ_VENUE_REQUIRED')
  nonEmpty(input.provenanceHash, 'MARKET_IQ_PROVENANCE_REQUIRED')
  finite(input.observedValue, 'MARKET_IQ_OBSERVED_VALUE_INVALID')
  nonNegative(input.liquidity, 'MARKET_IQ_LIQUIDITY_INVALID')
  nonNegative(input.spread, 'MARKET_IQ_SPREAD_INVALID')
  if (!input.evidenceRefs.length) throw new Error('MARKET_IQ_EVIDENCE_REQUIRED')
  const observed = timestamp(input.observedAt, 'MARKET_IQ_OBSERVED_AT_INVALID')
  const available = timestamp(input.availableAt, 'MARKET_IQ_AVAILABLE_AT_INVALID')
  const cutoff = timestamp(input.informationCutoff, 'MARKET_IQ_CUTOFF_INVALID')
  if (available < observed) throw new Error('MARKET_IQ_AVAILABLE_BEFORE_OBSERVED')
  if (cutoff < available) throw new Error('MARKET_IQ_CUTOFF_BEFORE_AVAILABLE')
  if (input.valueKind === 'PROBABILITY') unit(input.observedValue, 'MARKET_IQ_PROBABILITY_INVALID')

  return Object.freeze({
    ...input,
    evidenceRefs: unique(input.evidenceRefs),
    schemaVersion: MARKET_IQ_SCHEMA_VERSION,
    authority: 'INTELLIGENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export type PriceTruthAdjustment = Readonly<{
  adjustmentId: string
  effect: number
  confidence: number
  rationale: string
  evidenceRefs: readonly string[]
}>

export type PriceTruthPrimitive = Readonly<{
  observedMarketValue: number
  independentValue: number
  adjustedIndependentValue: number
  rawDivergence: number
  adjustedDivergence: number
  adjustments: readonly PriceTruthAdjustment[]
  valueKind: MarketValueKind
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  canAuthorizeTrade: false
}>

export function buildPriceTruthPrimitive(input: Readonly<{
  observedMarketValue: number
  independentValue: number
  valueKind: MarketValueKind
  adjustments?: readonly PriceTruthAdjustment[]
  evidenceRefs: readonly string[]
}>): PriceTruthPrimitive {
  finite(input.observedMarketValue, 'MARKET_IQ_PRICE_MARKET_VALUE_INVALID')
  finite(input.independentValue, 'MARKET_IQ_PRICE_INDEPENDENT_VALUE_INVALID')
  if (input.valueKind === 'PROBABILITY') {
    unit(input.observedMarketValue, 'MARKET_IQ_PRICE_MARKET_PROBABILITY_INVALID')
    unit(input.independentValue, 'MARKET_IQ_PRICE_INDEPENDENT_PROBABILITY_INVALID')
  }
  if (!input.evidenceRefs.length) throw new Error('MARKET_IQ_PRICE_EVIDENCE_REQUIRED')

  const adjustments = input.adjustments ?? []
  let adjusted = input.independentValue
  for (const item of adjustments) {
    nonEmpty(item.adjustmentId, 'MARKET_IQ_PRICE_ADJUSTMENT_ID_REQUIRED')
    finite(item.effect, 'MARKET_IQ_PRICE_ADJUSTMENT_EFFECT_INVALID')
    unit(item.confidence, 'MARKET_IQ_PRICE_ADJUSTMENT_CONFIDENCE_INVALID')
    nonEmpty(item.rationale, 'MARKET_IQ_PRICE_ADJUSTMENT_RATIONALE_REQUIRED')
    if (!item.evidenceRefs.length) throw new Error('MARKET_IQ_PRICE_ADJUSTMENT_EVIDENCE_REQUIRED')
    adjusted += item.effect * item.confidence
  }
  if (input.valueKind === 'PROBABILITY') adjusted = Math.max(0, Math.min(1, adjusted))

  return Object.freeze({
    observedMarketValue: input.observedMarketValue,
    independentValue: input.independentValue,
    adjustedIndependentValue: round(adjusted),
    rawDivergence: round(input.independentValue - input.observedMarketValue),
    adjustedDivergence: round(adjusted - input.observedMarketValue),
    adjustments: Object.freeze([...adjustments]),
    valueKind: input.valueKind,
    evidenceRefs: unique([
      ...input.evidenceRefs,
      ...adjustments.flatMap((item) => item.evidenceRefs),
    ]),
    authority: 'INTELLIGENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export type MarketActorClass =
  | 'FORECAST_SKILL'
  | 'FAST_INFORMATION'
  | 'MARKET_MAKER'
  | 'ARBITRAGE'
  | 'HEDGE'
  | 'POSSIBLE_INFORMED_FLOW'
  | 'COPY_TRADER'
  | 'NOISE'
  | 'UNKNOWN'

export type ActorClassEvidence = Readonly<{
  className: Exclude<MarketActorClass, 'UNKNOWN'>
  strength: number
  evidenceRefs: readonly string[]
}>

export type MarketActorClassification = Readonly<{
  actorId: string
  primaryClass: MarketActorClass
  confidence: number
  classWeights: Readonly<Record<MarketActorClass, number>>
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  canLabelInsider: false
  canAuthorizeTrade: false
}>

export function classifyMarketActor(input: Readonly<{
  actorId: string
  evidence: readonly ActorClassEvidence[]
}>): MarketActorClassification {
  nonEmpty(input.actorId, 'MARKET_IQ_ACTOR_ID_REQUIRED')
  const classes: MarketActorClass[] = [
    'FORECAST_SKILL',
    'FAST_INFORMATION',
    'MARKET_MAKER',
    'ARBITRAGE',
    'HEDGE',
    'POSSIBLE_INFORMED_FLOW',
    'COPY_TRADER',
    'NOISE',
    'UNKNOWN',
  ]
  const totals = new Map<MarketActorClass, number>(classes.map((name) => [name, 0]))
  for (const item of input.evidence) {
    unit(item.strength, 'MARKET_IQ_ACTOR_STRENGTH_INVALID')
    if (!item.evidenceRefs.length) throw new Error('MARKET_IQ_ACTOR_EVIDENCE_REQUIRED')
    totals.set(item.className, (totals.get(item.className) ?? 0) + item.strength)
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0)
  let primaryClass: MarketActorClass = 'UNKNOWN'
  let max = 0
  for (const [name, value] of totals) {
    if (name !== 'UNKNOWN' && value > max) {
      max = value
      primaryClass = name
    }
  }
  if (total === 0) totals.set('UNKNOWN', 1)
  const denominator = total || 1
  const weights = Object.fromEntries(
    classes.map((name) => [name, round((totals.get(name) ?? 0) / denominator)]),
  ) as Record<MarketActorClass, number>

  return Object.freeze({
    actorId: input.actorId,
    primaryClass,
    confidence: primaryClass === 'UNKNOWN' ? 0 : round(max / denominator),
    classWeights: Object.freeze(weights),
    evidenceRefs: unique(input.evidence.flatMap((item) => item.evidenceRefs)),
    authority: 'INTELLIGENCE_ONLY',
    canLabelInsider: false,
    canAuthorizeTrade: false,
  })
}

export type SkillSample = Readonly<{
  sampleId: string
  forecastProbability: number
  outcome: 0 | 1
  weight: number
  realizedNetEdge?: number
  evidenceRefs: readonly string[]
}>

export type PersistentSkillPolicy = Readonly<{
  minimumSamples: number
  maximumMeanBrier: number
  minimumPositiveEdgeShare?: number
}>

export type PersistentSkillAssessment = Readonly<{
  actorId: string
  sampleSize: number
  effectiveWeight: number
  meanBrier: number | null
  positiveEdgeShare: number | null
  status: 'INSUFFICIENT_DATA' | 'PERSISTENTLY_SKILLED' | 'MIXED' | 'UNSKILLED'
  policy: PersistentSkillPolicy
  evidenceRefs: readonly string[]
  authority: 'LEARNING_ONLY'
  canAuthorizeTrade: false
}>

export function evaluatePersistentSkill(input: Readonly<{
  actorId: string
  samples: readonly SkillSample[]
  policy: PersistentSkillPolicy
}>): PersistentSkillAssessment {
  nonEmpty(input.actorId, 'MARKET_IQ_SKILL_ACTOR_REQUIRED')
  if (!Number.isInteger(input.policy.minimumSamples) || input.policy.minimumSamples < 1) {
    throw new Error('MARKET_IQ_SKILL_MINIMUM_SAMPLES_INVALID')
  }
  unit(input.policy.maximumMeanBrier, 'MARKET_IQ_SKILL_BRIER_THRESHOLD_INVALID')
  if (input.policy.minimumPositiveEdgeShare !== undefined) {
    unit(input.policy.minimumPositiveEdgeShare, 'MARKET_IQ_SKILL_EDGE_THRESHOLD_INVALID')
  }
  let weightedBrier = 0
  let weight = 0
  let positiveEdgeWeight = 0
  let edgeWeight = 0
  for (const sample of input.samples) {
    nonEmpty(sample.sampleId, 'MARKET_IQ_SKILL_SAMPLE_ID_REQUIRED')
    unit(sample.forecastProbability, 'MARKET_IQ_SKILL_PROBABILITY_INVALID')
    positive(sample.weight, 'MARKET_IQ_SKILL_WEIGHT_INVALID')
    if (!sample.evidenceRefs.length) throw new Error('MARKET_IQ_SKILL_EVIDENCE_REQUIRED')
    weightedBrier += ((sample.forecastProbability - sample.outcome) ** 2) * sample.weight
    weight += sample.weight
    if (sample.realizedNetEdge !== undefined) {
      finite(sample.realizedNetEdge, 'MARKET_IQ_SKILL_REALIZED_EDGE_INVALID')
      edgeWeight += sample.weight
      if (sample.realizedNetEdge > 0) positiveEdgeWeight += sample.weight
    }
  }
  const meanBrier = weight ? round(weightedBrier / weight) : null
  const positiveEdgeShare = edgeWeight ? round(positiveEdgeWeight / edgeWeight) : null
  let status: PersistentSkillAssessment['status'] = 'INSUFFICIENT_DATA'
  if (input.samples.length >= input.policy.minimumSamples && meanBrier !== null) {
    const brierPass = meanBrier <= input.policy.maximumMeanBrier
    const edgePass =
      input.policy.minimumPositiveEdgeShare === undefined ||
      (positiveEdgeShare !== null && positiveEdgeShare >= input.policy.minimumPositiveEdgeShare)
    status = brierPass && edgePass ? 'PERSISTENTLY_SKILLED' : brierPass || edgePass ? 'MIXED' : 'UNSKILLED'
  }
  return Object.freeze({
    actorId: input.actorId,
    sampleSize: input.samples.length,
    effectiveWeight: round(weight),
    meanBrier,
    positiveEdgeShare,
    status,
    policy: Object.freeze({ ...input.policy }),
    evidenceRefs: unique(input.samples.flatMap((sample) => sample.evidenceRefs)),
    authority: 'LEARNING_ONLY',
    canAuthorizeTrade: false,
  })
}

export type InformationLatency = Readonly<{
  eventToAvailabilityMs: number
  availabilityToDetectionMs: number
  detectionToInterpretationMs: number
  interpretationToProposalMs: number | null
  totalEventToInterpretationMs: number
  totalEventToProposalMs: number | null
  authority: 'MEASUREMENT_ONLY'
}>

export function measureInformationLatency(input: Readonly<{
  eventObservedAt: string
  firstAvailableAt: string
  detectedAt: string
  interpretedAt: string
  proposalAt?: string
}>): InformationLatency {
  const event = timestamp(input.eventObservedAt, 'MARKET_IQ_LATENCY_EVENT_INVALID')
  const available = timestamp(input.firstAvailableAt, 'MARKET_IQ_LATENCY_AVAILABLE_INVALID')
  const detected = timestamp(input.detectedAt, 'MARKET_IQ_LATENCY_DETECTED_INVALID')
  const interpreted = timestamp(input.interpretedAt, 'MARKET_IQ_LATENCY_INTERPRETED_INVALID')
  const proposal = input.proposalAt ? timestamp(input.proposalAt, 'MARKET_IQ_LATENCY_PROPOSAL_INVALID') : null
  if (available < event || detected < available || interpreted < detected || (proposal !== null && proposal < interpreted)) {
    throw new Error('MARKET_IQ_LATENCY_TIME_ORDER_INVALID')
  }
  return Object.freeze({
    eventToAvailabilityMs: available - event,
    availabilityToDetectionMs: detected - available,
    detectionToInterpretationMs: interpreted - detected,
    interpretationToProposalMs: proposal === null ? null : proposal - interpreted,
    totalEventToInterpretationMs: interpreted - event,
    totalEventToProposalMs: proposal === null ? null : proposal - event,
    authority: 'MEASUREMENT_ONLY',
  })
}

export type MarketImpactElasticity = Readonly<{
  valueBefore: number
  valueAfter: number
  absoluteImpact: number
  capitalUsd: number
  impactPerThousandUsd: number
  laterValue: number | null
  reversionFraction: number | null
  evidenceRefs: readonly string[]
  authority: 'FORENSIC_EVIDENCE_ONLY'
  canProveManipulation: false
  canAuthorizeTrade: false
}>

export function measureMarketImpactElasticity(input: Readonly<{
  valueBefore: number
  valueAfter: number
  capitalUsd: number
  laterValue?: number
  evidenceRefs: readonly string[]
}>): MarketImpactElasticity {
  finite(input.valueBefore, 'MARKET_IQ_IMPACT_BEFORE_INVALID')
  finite(input.valueAfter, 'MARKET_IQ_IMPACT_AFTER_INVALID')
  positive(input.capitalUsd, 'MARKET_IQ_IMPACT_CAPITAL_INVALID')
  if (!input.evidenceRefs.length) throw new Error('MARKET_IQ_IMPACT_EVIDENCE_REQUIRED')
  if (input.laterValue !== undefined) finite(input.laterValue, 'MARKET_IQ_IMPACT_LATER_INVALID')
  const signedImpact = input.valueAfter - input.valueBefore
  const absoluteImpact = Math.abs(signedImpact)
  let reversionFraction: number | null = null
  if (input.laterValue !== undefined && absoluteImpact > 0) {
    const remaining = Math.abs(input.laterValue - input.valueBefore)
    reversionFraction = round(Math.max(0, Math.min(1, 1 - remaining / absoluteImpact)))
  }
  return Object.freeze({
    valueBefore: input.valueBefore,
    valueAfter: input.valueAfter,
    absoluteImpact: round(absoluteImpact),
    capitalUsd: input.capitalUsd,
    impactPerThousandUsd: round((absoluteImpact / input.capitalUsd) * 1000),
    laterValue: input.laterValue ?? null,
    reversionFraction,
    evidenceRefs: unique(input.evidenceRefs),
    authority: 'FORENSIC_EVIDENCE_ONLY',
    canProveManipulation: false,
    canAuthorizeTrade: false,
  })
}

export type CrowdParticipant = Readonly<{
  participantId: string
  weight: number
  independenceGroupId: string
  evidenceRefs: readonly string[]
}>

export type CrowdQualityAssessment = Readonly<{
  participantCount: number
  independentGroupCount: number
  herfindahlIndex: number
  effectiveParticipantCount: number
  effectiveParticipantRatio: number
  independenceRatio: number
  qualityScore: number
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  canAuthorizeTrade: false
}>

export function assessCrowdQuality(participants: readonly CrowdParticipant[]): CrowdQualityAssessment {
  if (!participants.length) throw new Error('MARKET_IQ_CROWD_PARTICIPANTS_REQUIRED')
  const ids = new Set<string>()
  let totalWeight = 0
  for (const participant of participants) {
    nonEmpty(participant.participantId, 'MARKET_IQ_CROWD_PARTICIPANT_ID_REQUIRED')
    nonEmpty(participant.independenceGroupId, 'MARKET_IQ_CROWD_GROUP_REQUIRED')
    positive(participant.weight, 'MARKET_IQ_CROWD_WEIGHT_INVALID')
    if (!participant.evidenceRefs.length) throw new Error('MARKET_IQ_CROWD_EVIDENCE_REQUIRED')
    if (ids.has(participant.participantId)) throw new Error('MARKET_IQ_CROWD_PARTICIPANT_DUPLICATE')
    ids.add(participant.participantId)
    totalWeight += participant.weight
  }
  const shares = participants.map((participant) => participant.weight / totalWeight)
  const herfindahlIndex = shares.reduce((sum, share) => sum + share * share, 0)
  const effectiveParticipantCount = 1 / herfindahlIndex
  const independentGroupCount = new Set(participants.map((participant) => participant.independenceGroupId)).size
  const effectiveParticipantRatio = Math.min(1, effectiveParticipantCount / participants.length)
  const independenceRatio = independentGroupCount / participants.length
  return Object.freeze({
    participantCount: participants.length,
    independentGroupCount,
    herfindahlIndex: round(herfindahlIndex),
    effectiveParticipantCount: round(effectiveParticipantCount),
    effectiveParticipantRatio: round(effectiveParticipantRatio),
    independenceRatio: round(independenceRatio),
    qualityScore: round((effectiveParticipantRatio + independenceRatio) / 2),
    evidenceRefs: unique(participants.flatMap((participant) => participant.evidenceRefs)),
    authority: 'INTELLIGENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export type ExecutableEdgeCost = Readonly<{
  kind: 'FEES' | 'SLIPPAGE' | 'ADVERSE_SELECTION' | 'RESOLUTION_RISK' | 'MODEL_UNCERTAINTY' | 'OTHER'
  amount: number
  evidenceRefs: readonly string[]
}>

export type NetExecutableEdge = Readonly<{
  direction: 'LONG' | 'SHORT'
  fairValue: number
  executableEntryValue: number
  grossEdge: number
  totalCosts: number
  netEdge: number
  costs: readonly ExecutableEdgeCost[]
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  canAuthorizeTrade: false
}>

export function buildNetExecutableEdge(input: Readonly<{
  direction: 'LONG' | 'SHORT'
  fairValue: number
  executableEntryValue: number
  costs: readonly ExecutableEdgeCost[]
  evidenceRefs: readonly string[]
}>): NetExecutableEdge {
  finite(input.fairValue, 'MARKET_IQ_EDGE_FAIR_VALUE_INVALID')
  finite(input.executableEntryValue, 'MARKET_IQ_EDGE_ENTRY_VALUE_INVALID')
  if (!input.evidenceRefs.length) throw new Error('MARKET_IQ_EDGE_EVIDENCE_REQUIRED')
  let totalCosts = 0
  for (const cost of input.costs) {
    nonNegative(cost.amount, 'MARKET_IQ_EDGE_COST_INVALID')
    if (!cost.evidenceRefs.length) throw new Error('MARKET_IQ_EDGE_COST_EVIDENCE_REQUIRED')
    totalCosts += cost.amount
  }
  const grossEdge =
    input.direction === 'LONG'
      ? input.fairValue - input.executableEntryValue
      : input.executableEntryValue - input.fairValue
  return Object.freeze({
    direction: input.direction,
    fairValue: input.fairValue,
    executableEntryValue: input.executableEntryValue,
    grossEdge: round(grossEdge),
    totalCosts: round(totalCosts),
    netEdge: round(grossEdge - totalCosts),
    costs: Object.freeze([...input.costs]),
    evidenceRefs: unique([
      ...input.evidenceRefs,
      ...input.costs.flatMap((cost) => cost.evidenceRefs),
    ]),
    authority: 'INTELLIGENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export type ConsensusObservation = Readonly<{
  observationId: string
  value: number
  calibrationWeight: number
  liquidityWeight: number
  independenceWeight: number
  manipulationResistanceWeight: number
  evidenceRefs: readonly string[]
}>

export type CrossVenueConsensus = Readonly<{
  observationCount: number
  consensusValue: number
  weightedStdDev: number
  maxDispersion: number
  leaderObservationId: string
  effectiveWeight: number
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  canAuthorizeTrade: false
}>

export function buildCrossVenueConsensus(observations: readonly ConsensusObservation[]): CrossVenueConsensus {
  if (observations.length < 2) throw new Error('MARKET_IQ_CONSENSUS_MIN_TWO_OBSERVATIONS')
  const ids = new Set<string>()
  const weighted = observations.map((observation) => {
    nonEmpty(observation.observationId, 'MARKET_IQ_CONSENSUS_ID_REQUIRED')
    finite(observation.value, 'MARKET_IQ_CONSENSUS_VALUE_INVALID')
    if (ids.has(observation.observationId)) throw new Error('MARKET_IQ_CONSENSUS_ID_DUPLICATE')
    ids.add(observation.observationId)
    unit(observation.calibrationWeight, 'MARKET_IQ_CONSENSUS_CALIBRATION_WEIGHT_INVALID')
    unit(observation.liquidityWeight, 'MARKET_IQ_CONSENSUS_LIQUIDITY_WEIGHT_INVALID')
    unit(observation.independenceWeight, 'MARKET_IQ_CONSENSUS_INDEPENDENCE_WEIGHT_INVALID')
    unit(observation.manipulationResistanceWeight, 'MARKET_IQ_CONSENSUS_MANIPULATION_WEIGHT_INVALID')
    if (!observation.evidenceRefs.length) throw new Error('MARKET_IQ_CONSENSUS_EVIDENCE_REQUIRED')
    const weight =
      observation.calibrationWeight *
      observation.liquidityWeight *
      observation.independenceWeight *
      observation.manipulationResistanceWeight
    return { observation, weight }
  })
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) throw new Error('MARKET_IQ_CONSENSUS_ZERO_EFFECTIVE_WEIGHT')
  const mean = weighted.reduce((sum, item) => sum + item.observation.value * item.weight, 0) / totalWeight
  const variance =
    weighted.reduce((sum, item) => sum + ((item.observation.value - mean) ** 2) * item.weight, 0) /
    totalWeight
  const values = observations.map((observation) => observation.value)
  const leader = [...weighted].sort((a, b) => b.weight - a.weight)[0]!
  return Object.freeze({
    observationCount: observations.length,
    consensusValue: round(mean),
    weightedStdDev: round(Math.sqrt(variance)),
    maxDispersion: round(Math.max(...values) - Math.min(...values)),
    leaderObservationId: leader.observation.observationId,
    effectiveWeight: round(totalWeight),
    evidenceRefs: unique(observations.flatMap((observation) => observation.evidenceRefs)),
    authority: 'INTELLIGENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export type TruthLayerKind =
  | 'CLAIM'
  | 'CONTRACT'
  | 'OWNERSHIP'
  | 'LIQUIDITY'
  | 'SUPPLY'
  | 'SOCIAL'
  | 'RESOLUTION'
  | 'TRADEABLE_REALITY'

export type TruthLayer = Readonly<{
  kind: TruthLayerKind
  status: 'VERIFIED' | 'PARTIAL' | 'CONTRADICTED' | 'UNKNOWN'
  confidence: number
  evidenceRefs: readonly string[]
}>

export type MarketTruthAssessment = Readonly<{
  layers: readonly TruthLayer[]
  coverage: number
  truthScore: number | null
  contradictionRisk: number | null
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  canAuthorizeTrade: false
}>

export function assessMarketTruth(input: Readonly<{
  layers: readonly TruthLayer[]
  expectedKinds?: readonly TruthLayerKind[]
}>): MarketTruthAssessment {
  if (!input.layers.length) throw new Error('MARKET_IQ_TRUTH_LAYERS_REQUIRED')
  const seen = new Set<TruthLayerKind>()
  let knownWeight = 0
  let truthWeight = 0
  let contradictionWeight = 0
  for (const layer of input.layers) {
    if (seen.has(layer.kind)) throw new Error('MARKET_IQ_TRUTH_LAYER_DUPLICATE')
    seen.add(layer.kind)
    unit(layer.confidence, 'MARKET_IQ_TRUTH_CONFIDENCE_INVALID')
    if (layer.status !== 'UNKNOWN' && !layer.evidenceRefs.length) {
      throw new Error('MARKET_IQ_TRUTH_EVIDENCE_REQUIRED')
    }
    if (layer.status !== 'UNKNOWN') {
      knownWeight += layer.confidence
      if (layer.status === 'VERIFIED') truthWeight += layer.confidence
      if (layer.status === 'PARTIAL') truthWeight += layer.confidence * 0.5
      if (layer.status === 'CONTRADICTED') contradictionWeight += layer.confidence
    }
  }
  const expected = input.expectedKinds?.length ? new Set(input.expectedKinds) : seen
  const covered = [...expected].filter((kind) => {
    const layer = input.layers.find((candidate) => candidate.kind === kind)
    return layer !== undefined && layer.status !== 'UNKNOWN'
  }).length
  return Object.freeze({
    layers: Object.freeze([...input.layers]),
    coverage: round(expected.size ? covered / expected.size : 0),
    truthScore: knownWeight ? round(truthWeight / knownWeight) : null,
    contradictionRisk: knownWeight ? round(contradictionWeight / knownWeight) : null,
    evidenceRefs: unique(input.layers.flatMap((layer) => layer.evidenceRefs)),
    authority: 'INTELLIGENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export type CounterfactualLearningRecord = Readonly<{
  recordId: string
  domain: MarketDomain
  subjectId: string
  consideredAt: string
  resolvedAt: string
  executed: boolean
  expectedDirection: 'UP' | 'DOWN' | 'FLAT'
  predictedNetEdge: number
  realizedDelta: number
  directionallyCorrect: boolean
  rejectReason?: string
  evidenceRefs: readonly string[]
  authority: 'LEARNING_ONLY'
  canMutateStrategyDirectly: false
}>

export function recordCounterfactualLearning(input: Omit<
  CounterfactualLearningRecord,
  'directionallyCorrect' | 'authority' | 'canMutateStrategyDirectly'
>): CounterfactualLearningRecord {
  nonEmpty(input.recordId, 'MARKET_IQ_COUNTERFACTUAL_ID_REQUIRED')
  nonEmpty(input.subjectId, 'MARKET_IQ_COUNTERFACTUAL_SUBJECT_REQUIRED')
  finite(input.predictedNetEdge, 'MARKET_IQ_COUNTERFACTUAL_PREDICTED_EDGE_INVALID')
  finite(input.realizedDelta, 'MARKET_IQ_COUNTERFACTUAL_REALIZED_DELTA_INVALID')
  if (!input.evidenceRefs.length) throw new Error('MARKET_IQ_COUNTERFACTUAL_EVIDENCE_REQUIRED')
  const considered = timestamp(input.consideredAt, 'MARKET_IQ_COUNTERFACTUAL_CONSIDERED_INVALID')
  const resolved = timestamp(input.resolvedAt, 'MARKET_IQ_COUNTERFACTUAL_RESOLVED_INVALID')
  if (resolved < considered) throw new Error('MARKET_IQ_COUNTERFACTUAL_RESOLUTION_BEFORE_CONSIDERATION')
  const directionallyCorrect =
    input.expectedDirection === 'FLAT'
      ? input.realizedDelta === 0
      : input.expectedDirection === 'UP'
        ? input.realizedDelta > 0
        : input.realizedDelta < 0
  return Object.freeze({
    ...input,
    directionallyCorrect,
    evidenceRefs: unique(input.evidenceRefs),
    authority: 'LEARNING_ONLY',
    canMutateStrategyDirectly: false,
  })
}

export type DomainCalibrationRecord = Readonly<{
  calibrationId: string
  domain: MarketDomain
  metric: string
  version: string
  sampleSize: number
  validFrom: string
  validUntil?: string
  parameters: Readonly<Record<string, number>>
  evidenceRefs: readonly string[]
  authority: 'CALIBRATION_ONLY'
}>

export type DomainCalibrationRegistry = Readonly<{
  records: readonly DomainCalibrationRecord[]
  authority: 'CALIBRATION_ONLY'
}>

export function buildDomainCalibrationRegistry(records: readonly DomainCalibrationRecord[]): DomainCalibrationRegistry {
  const keys = new Set<string>()
  for (const record of records) {
    nonEmpty(record.calibrationId, 'MARKET_IQ_CALIBRATION_ID_REQUIRED')
    nonEmpty(record.metric, 'MARKET_IQ_CALIBRATION_METRIC_REQUIRED')
    nonEmpty(record.version, 'MARKET_IQ_CALIBRATION_VERSION_REQUIRED')
    if (!Number.isInteger(record.sampleSize) || record.sampleSize < 0) {
      throw new Error('MARKET_IQ_CALIBRATION_SAMPLE_SIZE_INVALID')
    }
    timestamp(record.validFrom, 'MARKET_IQ_CALIBRATION_VALID_FROM_INVALID')
    if (record.validUntil !== undefined) {
      if (timestamp(record.validUntil, 'MARKET_IQ_CALIBRATION_VALID_UNTIL_INVALID') < Date.parse(record.validFrom)) {
        throw new Error('MARKET_IQ_CALIBRATION_WINDOW_INVALID')
      }
    }
    if (!record.evidenceRefs.length) throw new Error('MARKET_IQ_CALIBRATION_EVIDENCE_REQUIRED')
    for (const value of Object.values(record.parameters)) finite(value, 'MARKET_IQ_CALIBRATION_PARAMETER_INVALID')
    const key = [record.domain, record.metric, record.version].join(':')
    if (keys.has(key)) throw new Error('MARKET_IQ_CALIBRATION_DUPLICATE')
    keys.add(key)
    if (record.authority !== 'CALIBRATION_ONLY') throw new Error('MARKET_IQ_CALIBRATION_AUTHORITY_INVALID')
  }
  return Object.freeze({ records: Object.freeze([...records]), authority: 'CALIBRATION_ONLY' })
}

export type DomainTransferDecision = Readonly<{
  sourceDomain: MarketDomain
  targetDomain: MarketDomain
  mode: 'DIRECT' | 'HYPOTHESIS_ONLY'
  canPromoteWithoutTargetValidation: false
  rationale: string
}>

export function evaluateDomainTransfer(
  sourceDomain: MarketDomain,
  targetDomain: MarketDomain,
): DomainTransferDecision {
  const direct = sourceDomain === targetDomain
  return Object.freeze({
    sourceDomain,
    targetDomain,
    mode: direct ? 'DIRECT' : 'HYPOTHESIS_ONLY',
    canPromoteWithoutTargetValidation: false,
    rationale: direct
      ? 'Same-domain calibration may be reused when version and validity windows also match.'
      : 'Cross-domain intelligence is reusable only as a hypothesis until target-domain calibration validates it.',
  })
}

export type DomainObservationInput = Omit<
  MarketObservation,
  'schemaVersion' | 'domain' | 'authority' | 'canAuthorizeTrade'
>

const createDomainObservation = (domain: MarketDomain, input: DomainObservationInput): MarketObservation =>
  createMarketObservation({ ...input, domain })

export const createMemeCoinObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('MEME_COIN', input)
export const createPredictionObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('PREDICTION', input)
export const createSportsObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('SPORTS', input)
export const createStockObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('STOCK', input)
export const createCryptoObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('CRYPTO', input)
export const createForexObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('FOREX', input)
export const createPreciousMetalObservation = (input: DomainObservationInput): MarketObservation =>
  createDomainObservation('PRECIOUS_METAL', input)
