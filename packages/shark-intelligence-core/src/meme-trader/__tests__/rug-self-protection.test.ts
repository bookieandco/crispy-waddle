import {describe,expect,it} from 'vitest'
import {
  DEFAULT_PAPER_RUG_SELF_PROTECTION_THRESHOLDS,
  evaluateRugSelfProtection,
  type RugCriticalCoverage,
} from '../rug-self-protection'
import type { RugProtectionResult } from '../rug-protection'

const clean:RugProtectionResult={
  disposition:'ALLOW_CANDIDATE',
  score:10,
  hardBlockers:[],
  warnings:[],
  evidenceIds:['static:1'],
}
const coverage:RugCriticalCoverage={
  sellability:true,
  liquidityControl:true,
  authorityControl:true,
  holderIndependence:true,
  operatorIdentity:true,
}

describe('rug self protection',()=>{
  it('fails closed when a critical evidence family is missing',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:clean,
      coverage:{...coverage,holderIndependence:false},
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('QUARANTINE')
    expect(result.missingCriticalCoverage).toEqual(['holderIndependence'])
    expect(result.canAuthorizeTrade).toBe(false)
    expect(result.canAuthorizeExit).toBe(false)
  })

  it('never lets a model lower a deterministic block',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:{
        disposition:'BLOCK',
        score:100,
        hardBlockers:['freeze authority is live'],
        warnings:[],
        evidenceIds:['authority:1'],
      },
      coverage,
      modelSignals:[{
        modelId:'old-ethereum-model',
        rugProbability:0.01,
        calibration:'OUT_OF_DOMAIN',
        evidenceIds:['model:1'],
      }],
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('QUARANTINE')
    expect(result.canLowerDeterministicRisk).toBe(false)
  })

  it('uses calibrated high-risk model scores only as an escalation',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:clean,
      coverage,
      modelSignals:[{
        modelId:'paper-calibrated-ensemble',
        rugProbability:0.9,
        calibration:'PAPER_CALIBRATED',
        evidenceIds:['model:2'],
      }],
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('BLOCK_NEW_ENTRY')
    expect(result.modelEscalations).toEqual(['paper-calibrated-ensemble:0.900'])
  })

  it('ignores future runtime evidence at the point-in-time cutoff',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:clean,
      coverage,
      runtime:[{
        evidenceId:'future:drain',
        observedAt:'2026-09-26T20:00:01Z',
        availableAt:'2026-09-26T20:00:02Z',
        liquidityRemovedPct:0.9,
        source:'chain',
      }],
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('ALLOW_PAPER_STUDY')
    expect(result.evidenceIds).not.toContain('future:drain')
  })

  it('recommends exit on large observed liquidity removal',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:clean,
      coverage,
      runtime:[{
        evidenceId:'runtime:lp-remove',
        observedAt:'2026-09-26T19:59:58Z',
        availableAt:'2026-09-26T19:59:59Z',
        liquidityRemovedPct:DEFAULT_PAPER_RUG_SELF_PROTECTION_THRESHOLDS.emergencyLiquidityRemovalPct,
        source:'meteora',
      }],
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('EXIT_RECOMMENDED')
    expect(result.evidenceIds).toContain('runtime:lp-remove')
    expect(result.canAuthorizeExit).toBe(false)
  })

  it('detects the moving-window collapse pattern as runtime danger',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:clean,
      coverage,
      runtime:[{
        evidenceId:'runtime:collapse',
        observedAt:'2026-09-26T19:59:58Z',
        availableAt:'2026-09-26T19:59:59Z',
        drawdownFromPeak:0.7,
        volumeSpikeFactor:2,
        consecutiveDrops:4,
        secondsSincePeak:40,
        source:'trade-window',
      }],
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('EXIT_RECOMMENDED')
    expect(result.reasons).toContain('runtime collapse pattern detected')
  })

  it('recommends exit when operator-linked supply starts distributing',()=>{
    const result=evaluateRugSelfProtection({
      rugProtection:clean,
      coverage,
      runtime:[{
        evidenceId:'runtime:operator-sell',
        observedAt:'2026-09-26T19:59:58Z',
        availableAt:'2026-09-26T19:59:59Z',
        operatorDistributionPct:0.35,
        source:'entity-graph',
      }],
      informationCutoff:'2026-09-26T20:00:00Z',
    })
    expect(result.action).toBe('EXIT_RECOMMENDED')
  })
})
