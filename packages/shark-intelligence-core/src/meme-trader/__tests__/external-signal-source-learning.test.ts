import {describe,expect,it} from 'vitest'
import {createExternalSignalOutcome,summarizeExternalSignalSource} from '../external-signal-source-learning'

describe('external signal source learning',()=>{
  it('learns source outcomes without creating copy-trade authority',()=>{
    const a=createExternalSignalOutcome({
      outcomeId:'o1',platform:'TELEGRAM',sourceHandle:'AlphaChannel',channelId:'c1',
      signalObservationId:'s1',tokenCandidate:'MINT1',
      observedAt:'2026-10-03T03:00:00Z',resolvedAt:'2026-10-03T04:00:00Z',
      leadTimeMs:120000,migrated:true,rug:false,executableReturnBps:1800,independentDiscovery:true,
      evidenceIds:['signal:1','market:1'],
    })
    const b=createExternalSignalOutcome({
      outcomeId:'o2',platform:'TELEGRAM',sourceHandle:'AlphaChannel',channelId:'c1',
      signalObservationId:'s2',tokenCandidate:'MINT2',
      observedAt:'2026-10-03T05:00:00Z',resolvedAt:'2026-10-03T06:00:00Z',
      leadTimeMs:240000,migrated:false,rug:true,executableReturnBps:-900,independentDiscovery:false,
      evidenceIds:['signal:2','market:2'],
    })
    const summary=summarizeExternalSignalSource([a,b])
    expect(summary.sampleSize).toBe(2)
    expect(summary.migrationRate).toBe(.5)
    expect(summary.rugRate).toBe(.5)
    expect(summary.positiveExecutableReturnRate).toBe(.5)
    expect(summary.medianLeadTimeMs).toBe(180000)
    expect(summary.authority).toBe('LEARNING_ONLY')
    expect(summary.canAuthorizeTrade).toBe(false)
    expect(summary.canAutoCopy).toBe(false)
  })

  it('refuses to merge different source identities',()=>{
    const a=createExternalSignalOutcome({
      outcomeId:'o1',platform:'TELEGRAM',sourceHandle:'A',signalObservationId:'s1',tokenCandidate:'M1',
      observedAt:'2026-10-03T03:00:00Z',resolvedAt:'2026-10-03T04:00:00Z',evidenceIds:['e1'],
    })
    const b=createExternalSignalOutcome({
      outcomeId:'o2',platform:'TELEGRAM',sourceHandle:'B',signalObservationId:'s2',tokenCandidate:'M2',
      observedAt:'2026-10-03T03:00:00Z',resolvedAt:'2026-10-03T04:00:00Z',evidenceIds:['e2'],
    })
    expect(()=>summarizeExternalSignalSource([a,b])).toThrow('mixed_identity')
  })
})
