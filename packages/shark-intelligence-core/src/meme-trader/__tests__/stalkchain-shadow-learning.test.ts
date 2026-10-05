import {describe,expect,it} from 'vitest'
import {
  createStalkChainResearchPlan,
  createStalkChainShadowGrade,
  summarizeStalkChainShadowGrades,
} from '../stalkchain-shadow-learning'

describe('StalkChain shadow learning',()=>{
  it('grades executable outcomes without creating live authority',()=>{
    const grades=[
      createStalkChainShadowGrade({gradeId:'g1',subjectType:'TRADER',subjectId:'u1',tokenAddress:'A',horizon:'15M',decidedAt:'2026-10-01T00:00:00Z',evaluatedAt:'2026-10-01T00:15:00Z',executableReturnBps:500,rug:false,evidenceIds:['e1']}),
      createStalkChainShadowGrade({gradeId:'g2',subjectType:'TRADER',subjectId:'u1',tokenAddress:'B',horizon:'1H',decidedAt:'2026-10-01T00:00:00Z',evaluatedAt:'2026-10-01T01:00:00Z',executableReturnBps:-200,rug:false,evidenceIds:['e2']}),
      createStalkChainShadowGrade({gradeId:'g3',subjectType:'TRADER',subjectId:'u1',tokenAddress:'C',horizon:'24H',decidedAt:'2026-10-01T00:00:00Z',evaluatedAt:'2026-10-02T00:00:00Z',executableReturnBps:1000,rug:false,evidenceIds:['e3']}),
    ]
    const summary=summarizeStalkChainShadowGrades(grades)
    expect(summary.sampleSize).toBe(3)
    expect(summary.distinctTokenCount).toBe(3)
    expect(summary.positiveRate).toBeCloseTo(2/3)
    expect(summary.horizonCoverage['15M']).toBe(1)
    expect(summary.canAuthorizeLive).toBe(false)
  })

  it('creates a recurring research plan with no execution authority',()=>{
    const plan=createStalkChainResearchPlan({planId:'stalk-daily',cadence:'DAILY',emergingTraderLimit:25,tokenLimit:20})
    expect(plan.leaderboardWindows).toEqual(['24h','7d','30d'])
    expect(plan.includePositionChanges).toBe(true)
    expect(plan.includeIndependentVerification).toBe(true)
    expect(plan.canExecute).toBe(false)
    expect(plan.canAuthorizeTrade).toBe(false)
  })
})
