import {
  assessMarketTruth,
  buildCrossVenueConsensus,
  buildNetExecutableEdge,
  buildPriceTruthPrimitive,
  createPredictionObservation,
  type ConsensusObservation,
  type ExecutableEdgeCost,
  type MarketObservation,
  type MarketTruthAssessment,
  type NetExecutableEdge,
  type PriceTruthPrimitive,
  type CrossVenueConsensus,
  type TruthLayer,
} from '@jhadina/market-intelligence-core'
import type { IndependentProbabilityEstimate } from './prediction-market-intelligence.js'
import type { PredictionMarketSnapshot } from './prediction-market-reality.js'
import type { PredictionCrossVenueComparison } from './prediction-cross-venue-intelligence.js'

export const PREDICTION_MARKET_IQ_BRIDGE_VERSION = 'MONEY-PRED-MARKET-IQ-1' as const

export type PredictionVenueConsensusWeights = Readonly<{
  calibrationWeight: number
  liquidityWeight: number
  independenceWeight: number
  manipulationResistanceWeight: number
}>

export type PredictionMarketIqBridge = Readonly<{
  bridgeVersion: typeof PREDICTION_MARKET_IQ_BRIDGE_VERSION
  marketId: string
  outcomeId: string
  observation: MarketObservation
  priceTruth: PriceTruthPrimitive
  truth: MarketTruthAssessment
  consensus: CrossVenueConsensus | null
  executableEdge: NetExecutableEdge
  authority: 'INTELLIGENCE_ONLY'
  financialAuthority: 'NONE'
  canAuthorizeTrade: false
  canExecute: false
}>

export function buildPredictionMarketIqBridge(input: Readonly<{
  snapshot: PredictionMarketSnapshot
  estimate: IndependentProbabilityEstimate
  crossVenue?: PredictionCrossVenueComparison
  venueWeights?: Readonly<Record<string, PredictionVenueConsensusWeights>>
  truthLayers?: readonly TruthLayer[]
  costs: readonly ExecutableEdgeCost[]
}>): PredictionMarketIqBridge {
  if (
    input.snapshot.researchAuthority !== 'INTELLIGENCE_ONLY' ||
    input.snapshot.executionAuthority !== 'NONE' ||
    input.snapshot.financialAuthority !== 'NONE' ||
    input.estimate.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_PRED_MARKET_IQ_AUTHORITY_INVALID')
  }
  const state = input.snapshot.outcomes.find((candidate) => candidate.outcomeId === input.estimate.outcomeId)
  if (!state) throw new Error('MONEY_PRED_MARKET_IQ_OUTCOME_UNKNOWN')

  const observation = createPredictionObservation({
    observationId: ['prediction-market-iq', input.snapshot.snapshotId, input.estimate.outcomeId].join(':'),
    subjectId: [input.snapshot.marketId, input.estimate.outcomeId].join(':'),
    venue: input.snapshot.venue,
    valueKind: 'PROBABILITY',
    observedValue: state.midpointProbability,
    observedAt: input.snapshot.derivedAt,
    availableAt: input.snapshot.derivedAt,
    informationCutoff: input.snapshot.informationCutoff,
    liquidity:
      state.bidSize === undefined && state.askSize === undefined
        ? undefined
        : (state.bidSize ?? 0) + (state.askSize ?? 0),
    spread: state.spreadProbability,
    evidenceRefs: [...input.snapshot.evidenceRefs, ...state.evidenceRefs],
    provenanceHash: input.snapshot.snapshotHash,
  })

  const priceTruth = buildPriceTruthPrimitive({
    observedMarketValue: state.midpointProbability,
    independentValue: input.estimate.probability,
    valueKind: 'PROBABILITY',
    evidenceRefs: [...input.snapshot.evidenceRefs, ...input.estimate.evidenceRefs],
  })

  const truth = assessMarketTruth({
    expectedKinds: input.truthLayers?.map((layer) => layer.kind) ?? ['RESOLUTION'],
    layers:
      input.truthLayers?.length
        ? input.truthLayers
        : [{
            kind: 'RESOLUTION',
            status: 'VERIFIED',
            confidence: 1,
            evidenceRefs: input.snapshot.resolution.evidenceRefs,
          }],
  })

  let consensus: CrossVenueConsensus | null = null
  if (input.crossVenue) {
    if (
      input.crossVenue.authority !== 'INTELLIGENCE_ONLY' ||
      input.crossVenue.financialAuthority !== 'NONE' ||
      input.crossVenue.canExecute !== false ||
      input.crossVenue.canAuthorizeLive !== false
    ) {
      throw new Error('MONEY_PRED_MARKET_IQ_CROSS_VENUE_AUTHORITY_INVALID')
    }
    const observations: ConsensusObservation[] = input.crossVenue.observations.map((venueObservation) => {
      const weights = input.venueWeights?.[venueObservation.observationId] ?? {
        calibrationWeight: 1,
        liquidityWeight: 1,
        independenceWeight: 1,
        manipulationResistanceWeight: 1,
      }
      return {
        observationId: venueObservation.observationId,
        value: venueObservation.midpointProbability,
        ...weights,
        evidenceRefs: venueObservation.evidenceRefs,
      }
    })
    consensus = buildCrossVenueConsensus(observations)
  }

  const executableEdge = buildNetExecutableEdge({
    direction: 'LONG',
    fairValue: input.estimate.probability,
    executableEntryValue: state.askProbability,
    costs: input.costs,
    evidenceRefs: [...input.snapshot.evidenceRefs, ...input.estimate.evidenceRefs, ...state.evidenceRefs],
  })

  return Object.freeze({
    bridgeVersion: PREDICTION_MARKET_IQ_BRIDGE_VERSION,
    marketId: input.snapshot.marketId,
    outcomeId: input.estimate.outcomeId,
    observation,
    priceTruth,
    truth,
    consensus,
    executableEdge,
    authority: 'INTELLIGENCE_ONLY',
    financialAuthority: 'NONE',
    canAuthorizeTrade: false,
    canExecute: false,
  })
}
