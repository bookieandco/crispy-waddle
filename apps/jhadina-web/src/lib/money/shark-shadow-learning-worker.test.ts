import {describe,expect,it} from 'vitest'
import {shadowHorizonTarget,shadowPurseMemoryFromLesson,latestLessonPerDecision} from './shark-shadow-learning-worker'
import type {SharkShadowCounterfactualLesson} from '@jhadina/money-core'

const lesson:SharkShadowCounterfactualLesson={
  lessonId:'l1',decisionId:'d1',userId:'u1',strategyId:'SHARK_RUNTIME_NEW_PAIR',instrumentId:'meme:solana:abc',horizon:'1H',
  action:'PAPER_TRADE',marketRegime:'HIGH_LIQUIDITY:LOW_ANOMALY:BUY_FLOW:HIGH_TURNOVER',sourceGroups:['x','reddit'],
  confidenceBps:7000,underlyingReturnBps:1200,decisionReturnBps:1000,decisionQualityBps:1000,avoidedLossBps:0,missedGainBps:0,
  executionCostBps:200,regretBps:100,confidenceErrorBps:3000,timingDiagnosis:'GOOD_ENTRY',thesisHeld:true,lessonTags:['DECISION_POSITIVE'],
  evaluatedAt:'2026-10-03T18:05:00Z',evidenceIds:['e1'],authority:'LEARNING_ONLY',financialAuthority:'NONE',canExecute:false,canAuthorizeLive:false,
}

describe('SHARK shadow web worker helpers',()=>{
  it('uses bounded, non-overlapping outcome windows',()=>{
    expect(shadowHorizonTarget('2026-10-03T17:00:00Z','15M')).toEqual({dueAt:'2026-10-03T17:15:00.000Z',latestAt:'2026-10-03T17:59:59.999Z'})
    expect(shadowHorizonTarget('2026-10-03T17:00:00Z','7D')).toEqual({dueAt:'2026-10-10T17:00:00.000Z',latestAt:'2026-10-17T16:59:59.999Z'})
  })

  it('adapts lessons into Purse learning without live authority',()=>{
    const m=shadowPurseMemoryFromLesson(lesson)
    expect(m.source).toBe('PURSE_OUTCOME')
    expect(m.lane).toBe('MEME')
    expect(m.sampleWeight).toBe(1)
    expect(m.canAuthorizeLive).toBe(false)
    expect(m.confidenceAdjustmentBps).toBeLessThanOrEqual(600)
  })
  it('counts one shadow learning sample per distinct decision, regardless of observed horizon count',()=>{
    const earlier={...lesson,lessonId:'l-15m',horizon:'15M' as const,evaluatedAt:'2026-10-03T17:15:00Z',decisionQualityBps:200}
    const later={...lesson,lessonId:'l-7d',horizon:'7D' as const,evaluatedAt:'2026-10-10T18:05:00Z',decisionQualityBps:-400}
    const second={...lesson,lessonId:'l-other',decisionId:'d2'}
    const selected=latestLessonPerDecision([later,earlier,second,lesson,earlier])
    expect(selected).toHaveLength(2)
    expect(selected.find(x=>x.decisionId==='d1')?.lessonId).toBe('l-7d')
    expect(selected.map(shadowPurseMemoryFromLesson).reduce((n,x)=>n+x.sampleWeight,0)).toBe(2)
    expect(selected.every(x=>x.canAuthorizeLive===false)).toBe(true)
  })
  it('rejects invalid or unfounded lessons instead of promoting them into learned strategy profiles',()=>{
    expect(()=>latestLessonPerDecision([{...lesson,evidenceIds:[]}])).toThrow('SHADOW_PURSE_INVALID_LESSON_EVIDENCE')
    expect(()=>latestLessonPerDecision([{...lesson,canAuthorizeLive:true} as unknown as SharkShadowCounterfactualLesson])).toThrow('SHADOW_PURSE_INVALID_LESSON_EVIDENCE')
  })
})
