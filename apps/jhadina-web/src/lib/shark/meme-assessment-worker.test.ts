import {describe,expect,it,vi} from 'vitest'
import {runMemeAssessmentCycle} from './meme-assessment-worker'

const assessment:any={
  assessmentId:'assessment:1',
  assessedAt:'2026-10-03T03:00:05Z',
  token:{chainId:'solana-mainnet',tokenAddress:'MINT'},
  tradeType:'information-edge',
  marketActivityQuality:{score:.7,volumeScore:.7,liquidityScore:.7,flowScore:.7,manipulationPenalty:.1,reasons:[]},
  supplyControl:{score:.2,deployerRisk:.1,concentrationRisk:.2,bundledSupplyRisk:.2,liquidityControlRisk:.2,reasons:[]},
  holderCohort:{score:.6,profitableTrackedWallets:1,accumulatingWallets:2,distributingWallets:0,reasons:[]},
  attention:{score:.7,crossSourceConfirmation:.7,engagementQuality:.7,sourceCredibility:.7,manipulationPenalty:.1,reasons:[]},
  strategyFit:{score:.6,matchedSignals:['migration'],conflicts:[]},
  riskAssessment:{
    marketIntegrity:.1,liquidityRisk:.2,supplyControlRisk:.2,holderConcentrationRisk:.2,walletCohortRisk:.2,
    socialManipulationRisk:.1,narrativeFragilityRisk:.2,developerRisk:.1,contractRisk:0,networkRisk:.1,
    attentionQuality:.7,exitLiquidityRisk:.2,overallRisk:.25,band:'candidate',
  },
  rugProtection:{score:.1,disposition:'ALLOW',reasons:[],evidenceIds:['e1']},
  thesis:'Point-in-time migration candidate with independent evidence.',
  invalidation:{conditions:['liquidity collapses'],severity:'high'},
  positionPlan:{maxPositionFraction:.01,entryConditions:[],profitTakingConditions:[],exitConditions:[]},
  confidence:.6,
  evidenceIds:['e1'],
  assessmentVersion:'test-v1',
}

const evidence:any=[{
  evidenceId:'e1',source:'fixture',sourceGroup:'chain',stance:'SUPPORTS',direction:'BULLISH',
  strength:.6,confidence:.8,observedAt:'2026-10-03T03:00:00Z',availableAt:'2026-10-03T03:00:04Z',
  summary:'fixture evidence',immutable:true,
}]

describe('canonical meme assessment worker',()=>{
  it('uses one assessment for Money envelope and durable research persistence',async()=>{
    const createAssessment=vi.fn(async()=>assessment)
    const persistAssessment=vi.fn(async(_client:any,input:any)=>{
      expect(input.assessment).toBe(assessment)
      expect(input.informationCutoff).toBe('2026-10-03T03:00:04Z')
      return 'INSERTED' as const
    })
    const result=await runMemeAssessmentCycle({
      client:{} as any,assessment:{} as any,contextId:'ctx:1',evidence,source:'meme-worker',
    },{createAssessment,persistAssessment})
    expect(createAssessment).toHaveBeenCalledOnce()
    expect(result.envelope.assessment.assessmentId).toBe('assessment:1')
    expect(result.envelope.authority.financialExecution).toBe('NONE')
    expect(result.persistence).toBe('INSERTED')
    expect(result.authority).toBe('INTELLIGENCE_ONLY')
    expect(result.canAuthorizeTrade).toBe(false)
  })

  it('does not persist when required Money evidence metadata is missing',async()=>{
    const persistAssessment=vi.fn()
    await expect(runMemeAssessmentCycle({
      client:{} as any,assessment:{} as any,contextId:'ctx:1',evidence:[],source:'meme-worker',
    },{createAssessment:async()=>assessment,persistAssessment}))
      .rejects.toThrow('SHARK_MONEY_EVIDENCE_REQUIRED')
    expect(persistAssessment).not.toHaveBeenCalled()
  })
})
