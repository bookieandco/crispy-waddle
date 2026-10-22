import {describe,expect,it} from 'vitest'
import {fuseSniperIntelligence,type SniperIntelObservation} from './sniper-intel-fusion'
import type {SniperLiveRiskDecision} from '@jhadina/shark-intelligence-core/meme-trader'
import type {SharkShadowCounterfactualLesson,SniperPaperTradeReceipt,SniperSettlementEvidence} from '@jhadina/money-core'

const token='MINT1',cutoff='2026-10-22T18:00:00Z'
const risk={tokenAddress:token,disposition:'BLOCK',mechanisms:[{
 mechanism:'CONCENTRATED_DUMP',evidenceClass:'RISK_PATTERN',severity:'CRITICAL',trigger:'top10HolderPct',
}],reasonCodes:['DETERMINISTIC_RUG_BLOCK'],evidenceIds:['onchain:risk'],
 assessedAt:cutoff,authority:'RISK_RESEARCH_ONLY',canExecute:false} as const satisfies SniperLiveRiskDecision
const event=(evidenceId:string,source:SniperIntelObservation['source'],availableAt='2026-10-22T17:59:58Z',independenceGroup='operator:1'):SniperIntelObservation=>({
 tokenAddress:token,evidenceId,source,independenceGroup,
 observedAt:'2026-10-22T17:59:57Z',availableAt,
 claim:'BUNDLE_CLUSTER',verification:source==='TELEGRAM'||source==='YOUTUBE_TRANSCRIPT'?'CLAIM_ONLY':'CHAIN_ATTESTED',
})
const base={decisionId:'decision:1',tokenAddress:token,chainId:'solana-mainnet' as const,cutoff,risk}
const paper={runId:'run:1',tokenAddress:token,status:'CLOSED',realizedNetPnlMinor:999999n,
 authority:'PAPER_SIMULATION_ONLY',canExecute:false,canCreditPurse:false} as unknown as SniperPaperTradeReceipt
const lesson=(decisionId:string,lessonId:string,horizon:'15M'|'1H',evaluatedAt='2026-10-22T17:59:59Z')=>({
 instrumentId:'solana-mainnet:'+token,decisionId,lessonId,horizon,evaluatedAt,evidenceIds:['shadow:'+lessonId],
 authority:'LEARNING_ONLY',canExecute:false,canAuthorizeLive:false,
} as unknown as SharkShadowCounterfactualLesson)
const proof=(decisionId:string,lessonId:string,overrides:Record<string,unknown>={})=>({
 decisionId,lessonId,tokenAddress:token,
 observedAt:'2026-10-22T17:59:57Z',availableAt:'2026-10-22T17:59:58Z',
 returnBasis:'DECISION_RELATIVE' as const,independentlyVerified:true,
 independentEvidenceIds:['shadow:'+lessonId],...overrides,
})
const settlement=(overrides:Partial<SniperSettlementEvidence>={}):SniperSettlementEvidence=>({
 tokenAddress:token,outcomeId:'outcome:1',settledAt:'2026-10-22T17:59:58Z',
 availableAt:'2026-10-22T17:59:59Z',evidenceIds:['chain:tx:1'],
 kind:'ONCHAIN',independentlyVerified:true,realizedNetPnlLamports:-500000n,...overrides,
})
describe('SHARK + sniper + transcript/Telegram + Shadow research fusion',()=>{
 it('keeps YouTube/Telegram claims separate from independently verifiable chain signals, and deduplicates operator groups',()=>{
  const fused=fuseSniperIntelligence({...base,observations:[
   event('chain:1','CHAIN'),event('chain:2','HELIUS'),event('youtube:1','YOUTUBE_TRANSCRIPT'),
   event('telegram:1','TELEGRAM'),event('chain:1','CHAIN'),event('late:1','CHAIN','2026-10-22T18:00:03Z'),
  ]})
  expect(fused.admittedEvidenceIds).toEqual(['chain:1','chain:2'])
  expect(fused.hypothesisEvidenceIds).toEqual(['telegram:1','youtube:1'])
  expect(fused.quarantinedEvidenceIds).toEqual(['chain:1','late:1'])
  expect(fused.independentVerifiedGroups).toBe(1)
  expect(fused.claims[0].verifiedGroups).toBe(1)
  expect(fused.claims[0].hypothesisCount).toBe(2)
  expect(fused.rugMechanisms[0].mechanism).toBe('CONCENTRATED_DUMP')
  expect(fused.riskDisposition).toBe('BLOCK')
  expect(fused.canExecute).toBe(false)
  expect(fused.canMutateModel).toBe(false)
 })
 it('counts one independent Shadow decision across overlapping horizon lessons and excludes future hindsight',()=>{
  const fused=fuseSniperIntelligence({...base,priorShadowLessons:[
   lesson('d1','l1','15M'),lesson('d1','l2','1H'),lesson('d2','l3','1H'),
   lesson('d3','future','1H','2026-10-22T18:02:00Z'),
  ],priorLessonProofs:[
   proof('d1','l1'),proof('d1','l2'),proof('d2','l3'),
   proof('d3','future',{availableAt:'2026-10-22T18:02:00Z'}),
  ]})
  expect(fused.historicalIndependentDecisions).toBe(2)
  expect(fused.historicalLessonIds).toEqual(['l2','l3'])
  expect(fused.historicalLessonIds).not.toContain('future')
 })
 it('rejects ungraded, unsupported or legacy wrong-basis Shadow memories even if they claim profitability',()=>{
   const record=lesson('d1','legacy','15M')
   const ungraded=fuseSniperIntelligence({...base,priorShadowLessons:[record],
    priorLessonProofs:[proof('d1','legacy',{returnBasis:'UNAVAILABLE'})]})
   expect(ungraded.historicalIndependentDecisions).toBe(0)
   const noIndependent=fuseSniperIntelligence({...base,priorShadowLessons:[record],
    priorLessonProofs:[proof('d1','legacy',{independentlyVerified:false})]})
   expect(noIndependent.historicalIndependentDecisions).toBe(0)
   const noProof=fuseSniperIntelligence({...base,priorShadowLessons:[record]})
   expect(noProof.historicalIndependentDecisions).toBe(0)
   expect(noProof.deferredReasons).toContain('DECISION_RELATIVE_VERIFIED_SHADOW_LESSONS_MISSING')
 })
 it('paper profit never becomes real account settlement or signed trade authority',()=>{
  const fused=fuseSniperIntelligence({...base,paper,settlementTradeId:'decision:1',settlement:settlement({
   kind:'PAPER',independentlyVerified:false,realizedNetPnlLamports:999999n,
  })})
  expect(fused.paperTrade?.classification).toBe('SIMULATED_NOT_SETTLED')
  expect(fused.paperTrade?.realizedNetPnlMinor).toBe(999999n)
  expect(fused.followup?.grade).toBe('PAPER_ONLY')
  expect(fused.followup?.realizedNetPnlLamports).toBeUndefined()
  expect(fused.canCreditPurse).toBe(false)
  expect(fused.canAuthorizeLive).toBe(false)
 })
 it('separately recognizes an independent onchain outcome, but still cannot execute or credit Purse',()=>{
  const fused=fuseSniperIntelligence({...base,settlementTradeId:'decision:1',settlement:settlement()})
  expect(fused.followup?.grade).toBe('VERIFIED_ONCHAIN')
  expect(fused.followup?.realizedNetPnlLamports).toBe(-500000n)
  expect(fused.canSign).toBe(false)
  expect(fused.canCreditPurse).toBe(false)
 })
 it('rejects future, mismatched, incomplete or impossible settlement chronology',()=>{
  expect(()=>fuseSniperIntelligence({...base,settlementTradeId:'decision:1',settlement:settlement({availableAt:'2026-10-23T00:00:00Z'})})).toThrow()
  expect(()=>fuseSniperIntelligence({...base,settlementTradeId:'decision:1',settlement:settlement({tokenAddress:'other'})})).toThrow()
  expect(()=>fuseSniperIntelligence({...base,settlementTradeId:'decision:1',settlement:settlement({settledAt:'2026-10-22T18:00:00Z'})})).toThrow()
  expect(()=>fuseSniperIntelligence({...base,settlementTradeId:'wrong-decision',settlement:settlement()})).toThrow()
  expect(()=>fuseSniperIntelligence({...base,paper:{...paper,canExecute:true} as SniperPaperTradeReceipt})).toThrow()
 })
 it('ignores after-the-fact YouTube hype and ambiguous social claims for pretrade decisions',()=>{
  const fused=fuseSniperIntelligence({...base,observations:[
   {...event('video:after','YOUTUBE_TRANSCRIPT'),availableAt:'2026-10-22T18:01:00Z'},
   {...event('social:1','SOCIAL'),claim:'NARRATIVE',verification:'CLAIM_ONLY'},
  ]})
  expect(fused.admittedEvidenceIds).toHaveLength(0)
  expect(fused.hypothesisEvidenceIds).toEqual(['social:1'])
  expect(fused.quarantinedEvidenceIds).toEqual(['video:after'])
 })
})
