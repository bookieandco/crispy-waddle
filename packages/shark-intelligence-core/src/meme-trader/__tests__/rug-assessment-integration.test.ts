import { describe, expect, it } from 'vitest'
import { createMemeTradeAssessment } from '../assessment'
import { assessLPControlRisk } from '../lp-control-risk'
import { deriveLiquidityHistory } from '../liquidity-history'

const market = {
  observationId: 'market-1',
  source: 'dexscreener' as const,
  observedAt: '2026-09-02T00:00:00.000Z',
  receivedAt: '2026-09-02T00:00:01.000Z',
  chainId: 'solana',
  subjectId: 'TokenA',
  payload: { liquidityUsd: 100000, volume24hUsd: 250000, buys24h: 100, sells24h: 20 },
}

const baseInput = {
  assessmentId: 'assessment-1',
  assessedAt: '2026-09-02T00:10:00.000Z',
  market,
  tradeType: 'new-pair-speculation' as const,
  strategyFit: { score: .9, matchedSignals: ['flow'], conflicts: [] },
  attention: { score: .9, crossSourceConfirmation: .9, engagementQuality: .9, sourceCredibility: .9, manipulationPenalty: 0, reasons: [] },
  holderCohort: { score: .9, profitableTrackedWallets: 4, accumulatingWallets: 5, distributingWallets: 0, reasons: [] },
  thesis: 'strong test thesis',
  invalidation: { conditions: ['liquidity drain'], severity: 'high' as const },
  positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] },
  confidence: .9,
}

describe('rug protection integration', () => {
  it('blocks an assessment when LP control and liquidity trajectory signal a rug', () => {
    const liquidityHistory = deriveLiquidityHistory([
      { observedAt: '2026-09-02T00:00:00.000Z', liquidityUsd: 100000, source: 'dex', evidenceId: 'liq-1' },
      { observedAt: '2026-09-02T00:05:00.000Z', liquidityUsd: 60000, source: 'dex', evidenceId: 'liq-2' },
      { observedAt: '2026-09-02T00:06:00.000Z', liquidityUsd: 20000, source: 'dex', evidenceId: 'liq-3' },
    ])
    const lpControlRisk = assessLPControlRisk({
      lpOwnerKnown: true,
      lpOwnerIsDeployer: true,
      lpLockedPct: 0,
      liquidityHistory,
      evidenceIds: liquidityHistory.evidenceIds,
    })

    const assessment = createMemeTradeAssessment({ ...baseInput, liquidityHistory, lpControlRisk })

    expect(lpControlRisk.band).toBe('critical')
    expect(assessment.rugProtection.disposition).toBe('BLOCK')
    expect(assessment.riskAssessment.band).toBe('blocked')
    expect(assessment.riskAssessment.overallRisk).toBe(1)
    expect(assessment.evidenceIds).toEqual(expect.arrayContaining(['liq-1', 'liq-2', 'liq-3']))
  })

  it('does not block a clean liquidity trajectory solely because liquidity is present', () => {
    const liquidityHistory = deriveLiquidityHistory([
      { observedAt: '2026-09-02T00:00:00.000Z', liquidityUsd: 100000, source: 'dex', evidenceId: 'liq-a' },
      { observedAt: '2026-09-02T00:05:00.000Z', liquidityUsd: 101000, source: 'dex', evidenceId: 'liq-b' },
      { observedAt: '2026-09-02T00:10:00.000Z', liquidityUsd: 100500, source: 'dex', evidenceId: 'liq-c' },
    ])
    const lpControlRisk = assessLPControlRisk({
      lpOwnerKnown: true,
      lpOwnerIsDeployer: false,
      lpBurnedPct: 100,
      lpLockedPct: 0,
      liquidityHistory,
      evidenceIds: liquidityHistory.evidenceIds,
    })

    const assessment = createMemeTradeAssessment({ ...baseInput, liquidityHistory, lpControlRisk })

    expect(assessment.rugProtection.disposition).not.toBe('BLOCK')
    expect(assessment.evidenceIds).toEqual(expect.arrayContaining(['liq-a', 'liq-b', 'liq-c']))
  })

  it('prevents a RugProtection review from becoming a favorable candidate', () => {
    const assessment = createMemeTradeAssessment({
      ...baseInput,
      rugProtectionInput: { mintAuthorityLive: true },
    })

    expect(assessment.rugProtection.disposition).toBe('REVIEW')
    expect(assessment.riskAssessment.band).toBe('watch')
  })

  it('blocks entry when self-protection coverage is incomplete', () => {
    const assessment = createMemeTradeAssessment({
      ...baseInput,
      rugSelfProtectionInput: {
        coverage: {
          sellability: true,
          liquidityControl: true,
          authorityControl: true,
          holderIndependence: false,
          operatorIdentity: true,
        },
        informationCutoff: '2026-09-02T00:10:00.000Z',
      },
    })

    expect(assessment.rugSelfProtection?.action).toBe('QUARANTINE')
    expect(assessment.riskAssessment.band).toBe('blocked')
    expect(assessment.riskAssessment.overallRisk).toBe(1)
  })

  it('blocks new entry when the runtime sentinel sees operator-linked distribution', () => {
    const assessment = createMemeTradeAssessment({
      ...baseInput,
      rugSelfProtectionInput: {
        coverage: {
          sellability: true,
          liquidityControl: true,
          authorityControl: true,
          holderIndependence: true,
          operatorIdentity: true,
        },
        runtime: [{
          evidenceId: 'operator-sell-1',
          observedAt: '2026-09-02T00:09:58.000Z',
          availableAt: '2026-09-02T00:09:59.000Z',
          operatorDistributionPct: .35,
          source: 'entity-graph',
        }],
        informationCutoff: '2026-09-02T00:10:00.000Z',
      },
    })

    expect(assessment.rugSelfProtection?.action).toBe('EXIT_RECOMMENDED')
    expect(assessment.riskAssessment.band).toBe('blocked')
    expect(assessment.evidenceIds).toContain('operator-sell-1')
  })


  it('treats a higher market anomaly score as higher integrity risk', () => {
    const clean = createMemeTradeAssessment({
      ...baseInput,
      assessmentId: 'assessment-clean',
      market: { ...market, payload: { ...market.payload, anomalyScore: .1 } },
    })
    const anomalous = createMemeTradeAssessment({
      ...baseInput,
      assessmentId: 'assessment-anomalous',
      market: { ...market, payload: { ...market.payload, anomalyScore: .9 } },
    })

    expect(clean.riskAssessment.marketIntegrity).toBe(.1)
    expect(anomalous.riskAssessment.marketIntegrity).toBe(.9)
    expect(anomalous.riskAssessment.overallRisk).toBeGreaterThan(clean.riskAssessment.overallRisk)
    expect(anomalous.rugProtection.score).toBeGreaterThan(clean.rugProtection.score)
  })


  it('uses only calibrated synthetic-volume diagnostics as anomaly risk evidence', () => {
    const uncalibrated:any = {
      sampleSize:4,
      feeToVolumeRatio:.00025,
      volumeToLiquidityRatio:20,
      repeatedBuySizeShare:1,
      timingRegularity:1,
      commonFundingGroupShare:1,
      mirroredTradeShare:1,
      flags:[],
      calibratedRiskScore:undefined,
      evaluatedThresholdCount:0,
      coverage:{fees:true,liquidity:true,buySizes:true,timing:true,funding:true,mirroredFlow:true},
      evidenceIds:['synthetic:uncalibrated'],
      authority:'FORENSIC_EVIDENCE_ONLY',
      canLabelWashTrading:false,
      canAuthorizeTrade:false,
    }
    const calibrated:any = {
      ...uncalibrated,
      flags:['fee-to-volume-below-calibrated-floor','transaction-timing-too-regular'],
      calibratedRiskScore:.8,
      evaluatedThresholdCount:2,
      evidenceIds:['synthetic:calibrated'],
    }

    const baseline=createMemeTradeAssessment({
      ...baseInput,
      assessmentId:'assessment-synth-base',
      market:{...market,payload:{...market.payload,anomalyScore:.2}},
      syntheticVolumeDiagnostics:uncalibrated,
    })
    const elevated=createMemeTradeAssessment({
      ...baseInput,
      assessmentId:'assessment-synth-calibrated',
      market:{...market,payload:{...market.payload,anomalyScore:.2}},
      syntheticVolumeDiagnostics:calibrated,
    })

    expect(baseline.riskAssessment.marketIntegrity).toBe(.2)
    expect(elevated.riskAssessment.marketIntegrity).toBe(.8)
    expect(elevated.marketActivityQuality.manipulationPenalty).toBe(.8)
    expect(elevated.rugProtection.score).toBeGreaterThan(baseline.rugProtection.score)
    expect(elevated.evidenceIds).toContain('synthetic:calibrated')
    expect(elevated.syntheticVolumeDiagnostics?.canAuthorizeTrade).toBe(false)
    expect(elevated.syntheticVolumeDiagnostics?.canLabelWashTrading).toBe(false)
  })

  it('rejects synthetic-volume evidence that attempts authority escalation', () => {
    expect(()=>createMemeTradeAssessment({
      ...baseInput,
      assessmentId:'assessment-synth-authority',
      syntheticVolumeDiagnostics:{
        sampleSize:1,flags:[],evaluatedThresholdCount:0,
        coverage:{fees:false,liquidity:false,buySizes:false,timing:false,funding:false,mirroredFlow:false},
        evidenceIds:['synthetic:bad'],authority:'FORENSIC_EVIDENCE_ONLY',
        canLabelWashTrading:false,canAuthorizeTrade:true,
      } as any,
    })).toThrow('synthetic volume diagnostics authority escalation forbidden')
  })

})
