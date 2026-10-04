import {
  assessCrowdQuality,
  assessMarketTruth,
  buildNetExecutableEdge,
  buildPriceTruthPrimitive,
  classifyMarketActor,
  createMemeCoinObservation,
  type ActorClassEvidence,
  type ExecutableEdgeCost,
  type MarketActorClassification,
  type MarketObservation,
  type MarketTruthAssessment,
  type NetExecutableEdge,
  type PriceTruthPrimitive,
  type TruthLayer,
  type CrowdQualityAssessment,
} from '@jhadina/market-intelligence-core'
import type { ExternalSignalIndependenceAssessment } from './external-signal-independence'
import type { SyntheticVolumeDiagnostics } from './synthetic-volume-diagnostics'

export const SHARK_MARKET_IQ_BRIDGE_VERSION = 'SHARK-MARKET-IQ-1' as const

export type SharkMarketIqSnapshot = Readonly<{
  bridgeVersion: typeof SHARK_MARKET_IQ_BRIDGE_VERSION
  tokenAddress: string
  observation: MarketObservation
  priceTruth: PriceTruthPrimitive | null
  crowdQuality: CrowdQualityAssessment | null
  actor: MarketActorClassification | null
  truth: MarketTruthAssessment | null
  executableEdge: NetExecutableEdge | null
  syntheticVolumeRiskScore: number | null
  evidenceRefs: readonly string[]
  authority: 'INTELLIGENCE_ONLY'
  financialAuthority: 'NONE'
  canAuthorizeTrade: false
  canExecute: false
}>

const unique = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values.filter((value) => value.trim()))].sort())

export function buildSharkMarketIqSnapshot(input: Readonly<{
  tokenAddress: string
  venue: string
  currentPrice: number
  observedAt: string
  availableAt: string
  informationCutoff: string
  liquidityUsd?: number
  spreadPrice?: number
  evidenceRefs: readonly string[]
  provenanceHash: string
  independentFairValue?: number
  priceAdjustments?: Parameters<typeof buildPriceTruthPrimitive>[0]['adjustments']
  signalIndependence?: ExternalSignalIndependenceAssessment
  syntheticVolumeDiagnostics?: SyntheticVolumeDiagnostics
  actorId?: string
  actorEvidence?: readonly ActorClassEvidence[]
  truthLayers?: readonly TruthLayer[]
  edgeCosts?: readonly ExecutableEdgeCost[]
}>): SharkMarketIqSnapshot {
  if (!input.tokenAddress.trim()) throw new Error('SHARK_MARKET_IQ_TOKEN_REQUIRED')
  if (!input.evidenceRefs.length) throw new Error('SHARK_MARKET_IQ_EVIDENCE_REQUIRED')

  const observation = createMemeCoinObservation({
    observationId: ['shark-market-iq', input.venue, input.tokenAddress, input.informationCutoff].join(':'),
    subjectId: input.tokenAddress,
    venue: input.venue,
    valueKind: 'PRICE',
    observedValue: input.currentPrice,
    observedAt: input.observedAt,
    availableAt: input.availableAt,
    informationCutoff: input.informationCutoff,
    liquidity: input.liquidityUsd,
    spread: input.spreadPrice,
    evidenceRefs: input.evidenceRefs,
    provenanceHash: input.provenanceHash,
  })

  const priceTruth =
    input.independentFairValue === undefined
      ? null
      : buildPriceTruthPrimitive({
          observedMarketValue: input.currentPrice,
          independentValue: input.independentFairValue,
          valueKind: 'PRICE',
          adjustments: input.priceAdjustments,
          evidenceRefs: input.evidenceRefs,
        })

  let crowdQuality: CrowdQualityAssessment | null = null
  if (input.signalIndependence) {
    if (input.signalIndependence.authority !== 'EVIDENCE_ONLY' || input.signalIndependence.canAuthorizeTrade !== false) {
      throw new Error('SHARK_MARKET_IQ_SIGNAL_AUTHORITY_INVALID')
    }
    if (input.signalIndependence.groups.length) {
      crowdQuality = assessCrowdQuality(
        input.signalIndependence.groups.map((group) => ({
          participantId: group.groupId,
          weight: Math.max(1, group.sourceIds.length),
          independenceGroupId: group.groupId,
          evidenceRefs: input.signalIndependence!.evidenceIds,
        })),
      )
    }
  }

  const actor =
    input.actorId && input.actorEvidence
      ? classifyMarketActor({ actorId: input.actorId, evidence: input.actorEvidence })
      : null

  const truth =
    input.truthLayers?.length
      ? assessMarketTruth({ layers: input.truthLayers })
      : null

  const executableEdge =
    input.independentFairValue === undefined
      ? null
      : buildNetExecutableEdge({
          direction: 'LONG',
          fairValue: input.independentFairValue,
          executableEntryValue: input.currentPrice,
          costs: input.edgeCosts ?? [],
          evidenceRefs: input.evidenceRefs,
        })

  if (
    input.syntheticVolumeDiagnostics &&
    (input.syntheticVolumeDiagnostics.authority !== 'FORENSIC_EVIDENCE_ONLY' ||
      input.syntheticVolumeDiagnostics.canAuthorizeTrade !== false)
  ) {
    throw new Error('SHARK_MARKET_IQ_SYNTHETIC_VOLUME_AUTHORITY_INVALID')
  }

  const evidenceRefs = unique([
    ...input.evidenceRefs,
    ...(input.signalIndependence?.evidenceIds ?? []),
    ...(input.syntheticVolumeDiagnostics?.evidenceIds ?? []),
    ...(actor?.evidenceRefs ?? []),
    ...(truth?.evidenceRefs ?? []),
    ...(executableEdge?.evidenceRefs ?? []),
  ])

  return Object.freeze({
    bridgeVersion: SHARK_MARKET_IQ_BRIDGE_VERSION,
    tokenAddress: input.tokenAddress,
    observation,
    priceTruth,
    crowdQuality,
    actor,
    truth,
    executableEdge,
    syntheticVolumeRiskScore: input.syntheticVolumeDiagnostics?.calibratedRiskScore ?? null,
    evidenceRefs,
    authority: 'INTELLIGENCE_ONLY',
    financialAuthority: 'NONE',
    canAuthorizeTrade: false,
    canExecute: false,
  })
}
