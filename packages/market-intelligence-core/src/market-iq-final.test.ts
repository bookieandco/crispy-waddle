import { describe, expect, it } from 'vitest'
import {
  assessCrowdQuality,
  assessMarketTruth,
  buildCrossVenueConsensus,
  buildDomainCalibrationRegistry,
  buildNetExecutableEdge,
  buildPriceTruthPrimitive,
  classifyMarketActor,
  createMemeCoinObservation,
  evaluateDomainTransfer,
  evaluatePersistentSkill,
  measureInformationLatency,
  measureMarketImpactElasticity,
  recordCounterfactualLearning,
} from './index'

describe('MARKET-IQ.FINAL shared primitives', () => {
  it('keeps price, truth, actor skill, liquidity, manipulation and learning separate', () => {
    const observation = createMemeCoinObservation({
      observationId: 'obs:1',
      subjectId: 'token:ABC',
      venue: 'dex-a',
      valueKind: 'PRICE',
      observedValue: 1.2,
      observedAt: '2026-10-04T18:00:00.000Z',
      availableAt: '2026-10-04T18:00:01.000Z',
      informationCutoff: '2026-10-04T18:00:02.000Z',
      liquidity: 100000,
      spread: 0.01,
      evidenceRefs: ['e:price'],
      provenanceHash: 'p:1',
    })
    expect(observation.authority).toBe('INTELLIGENCE_ONLY')
    expect(observation.canAuthorizeTrade).toBe(false)

    const priceTruth = buildPriceTruthPrimitive({
      observedMarketValue: 0.72,
      independentValue: 0.65,
      valueKind: 'PROBABILITY',
      adjustments: [{
        adjustmentId: 'adj:resolution',
        effect: -0.02,
        confidence: 0.5,
        rationale: 'Resolution uncertainty',
        evidenceRefs: ['e:resolution'],
      }],
      evidenceRefs: ['e:market', 'e:model'],
    })
    expect(priceTruth.rawDivergence).toBe(-0.07)
    expect(priceTruth.adjustedIndependentValue).toBe(0.64)

    const actor = classifyMarketActor({
      actorId: 'wallet:1',
      evidence: [
        { className: 'FAST_INFORMATION', strength: 0.8, evidenceRefs: ['e:lead'] },
        { className: 'COPY_TRADER', strength: 0.2, evidenceRefs: ['e:copy'] },
      ],
    })
    expect(actor.primaryClass).toBe('FAST_INFORMATION')
    expect(actor.canLabelInsider).toBe(false)

    const skill = evaluatePersistentSkill({
      actorId: 'wallet:1',
      samples: [
        { sampleId: 's1', forecastProbability: 0.9, outcome: 1, weight: 1, realizedNetEdge: 0.1, evidenceRefs: ['e:s1'] },
        { sampleId: 's2', forecastProbability: 0.8, outcome: 1, weight: 1, realizedNetEdge: 0.05, evidenceRefs: ['e:s2'] },
      ],
      policy: { minimumSamples: 2, maximumMeanBrier: 0.1, minimumPositiveEdgeShare: 0.5 },
    })
    expect(skill.status).toBe('PERSISTENTLY_SKILLED')

    const latency = measureInformationLatency({
      eventObservedAt: '2026-10-04T18:00:00.000Z',
      firstAvailableAt: '2026-10-04T18:00:01.000Z',
      detectedAt: '2026-10-04T18:00:02.000Z',
      interpretedAt: '2026-10-04T18:00:04.000Z',
      proposalAt: '2026-10-04T18:00:05.000Z',
    })
    expect(latency.totalEventToProposalMs).toBe(5000)

    const impact = measureMarketImpactElasticity({
      valueBefore: 0.58,
      valueAfter: 0.67,
      laterValue: 0.61,
      capitalUsd: 5_000_000,
      evidenceRefs: ['e:impact'],
    })
    expect(impact.canProveManipulation).toBe(false)
    expect(impact.reversionFraction).toBeGreaterThan(0)

    const crowd = assessCrowdQuality([
      { participantId: 'a', weight: 10, independenceGroupId: 'g1', evidenceRefs: ['e:a'] },
      { participantId: 'b', weight: 1, independenceGroupId: 'g2', evidenceRefs: ['e:b'] },
      { participantId: 'c', weight: 1, independenceGroupId: 'g3', evidenceRefs: ['e:c'] },
    ])
    expect(crowd.qualityScore).toBeLessThan(1)

    const edge = buildNetExecutableEdge({
      direction: 'LONG',
      fairValue: 0.7,
      executableEntryValue: 0.65,
      costs: [
        { kind: 'FEES', amount: 0.01, evidenceRefs: ['e:fee'] },
        { kind: 'SLIPPAGE', amount: 0.02, evidenceRefs: ['e:slippage'] },
      ],
      evidenceRefs: ['e:fair', 'e:ask'],
    })
    expect(edge.netEdge).toBe(0.02)

    const consensus = buildCrossVenueConsensus([
      {
        observationId: 'v1',
        value: 0.68,
        calibrationWeight: 1,
        liquidityWeight: 1,
        independenceWeight: 1,
        manipulationResistanceWeight: 1,
        evidenceRefs: ['e:v1'],
      },
      {
        observationId: 'v2',
        value: 0.72,
        calibrationWeight: 0.8,
        liquidityWeight: 0.8,
        independenceWeight: 1,
        manipulationResistanceWeight: 0.9,
        evidenceRefs: ['e:v2'],
      },
    ])
    expect(consensus.consensusValue).toBeGreaterThan(0.68)
    expect(consensus.consensusValue).toBeLessThan(0.72)

    const truth = assessMarketTruth({
      expectedKinds: ['CONTRACT', 'LIQUIDITY', 'SOCIAL'],
      layers: [
        { kind: 'CONTRACT', status: 'VERIFIED', confidence: 1, evidenceRefs: ['e:contract'] },
        { kind: 'LIQUIDITY', status: 'PARTIAL', confidence: 0.8, evidenceRefs: ['e:liq'] },
        { kind: 'SOCIAL', status: 'CONTRADICTED', confidence: 0.9, evidenceRefs: ['e:social'] },
      ],
    })
    expect(truth.coverage).toBe(1)
    expect(truth.contradictionRisk).toBeGreaterThan(0)

    const counterfactual = recordCounterfactualLearning({
      recordId: 'cf:1',
      domain: 'MEME_COIN',
      subjectId: 'token:ABC',
      consideredAt: '2026-10-04T18:00:00.000Z',
      resolvedAt: '2026-10-04T19:00:00.000Z',
      executed: false,
      expectedDirection: 'UP',
      predictedNetEdge: 0.04,
      realizedDelta: -0.2,
      rejectReason: 'risk gate',
      evidenceRefs: ['e:resolution'],
    })
    expect(counterfactual.directionallyCorrect).toBe(false)
    expect(counterfactual.canMutateStrategyDirectly).toBe(false)

    const registry = buildDomainCalibrationRegistry([{
      calibrationId: 'cal:1',
      domain: 'PREDICTION',
      metric: 'longshot-bias',
      version: 'v1',
      sampleSize: 1000,
      validFrom: '2026-01-01T00:00:00.000Z',
      parameters: { slope: 0.9 },
      evidenceRefs: ['e:cal'],
      authority: 'CALIBRATION_ONLY',
    }])
    expect(registry.records).toHaveLength(1)
    expect(evaluateDomainTransfer('PREDICTION', 'MEME_COIN').mode).toBe('HYPOTHESIS_ONLY')
    expect(evaluateDomainTransfer('PREDICTION', 'PREDICTION').mode).toBe('DIRECT')
  })
})
