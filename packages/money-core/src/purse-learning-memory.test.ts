import test from 'node:test'
import assert from 'node:assert/strict'
import {
 buildPurseLearningContext,
 buildPurseStrategyLearningProfile,
 derivePurseFinancialTemperament,
 learningAdjustmentForOpportunity,
 purseLearningFromShark,
 purseLearningFromSportsEpisode,
 purseLearningFromStrategyRecord,
 type PursePersonalitySnapshot,
} from './purse-learning-memory.js'
import type { StrategyLearningRecord } from './autonomous-strategy-learning.js'
import type { SportsLearningEpisode } from './sports-learning-memory.js'

const records=(returns:number[]):StrategyLearningRecord[]=>returns.map((returnBps,index)=>Object.freeze({
 learningRecordId:'paper:'+index,domain:'STOCK',strategyId:'stock-alpha',scenarioId:'s'+index,paperRunId:'r'+index,strategyResultId:'sr'+index,
 returnBps,fillRateBps:9500,slippageBps:20,feesPaidMinor:'10',outcomeScore:Math.max(-1,Math.min(1,returnBps/10000)),executionQuality:.9,
 evidenceIds:Object.freeze(['paper:e:'+index]),evaluatedAt:'2026-10-01T0'+index+':00:00.000Z',authority:'LEARNING_ONLY',canAuthorizeLive:false,
}))

test('paper trading memory becomes a Purse strategy profile and never grants live authority',()=>{
 const episodes=records([3000,2500,2000]).map(purseLearningFromStrategyRecord)
 const profile=buildPurseStrategyLearningProfile({lane:'STOCK',strategyId:'stock-alpha',episodes,calibratedAt:'2026-10-01T05:00:00.000Z',minimumSamples:3})
 assert.equal(profile.disposition,'SUPPORTED')
 assert.ok(profile.sizingMultiplierBps>=9000&&profile.sizingMultiplierBps<=10000)
 assert.ok(profile.confidenceAdjustmentBps>0)
 assert.equal(profile.financialAuthority,'NONE')
 assert.equal(profile.canAuthorizeLive,false)
})

test('SHARK closed-trade lessons feed MEME Purse learning including narrative, signals, sizing and execution',()=>{
 const episode=purseLearningFromShark(Object.freeze({
  learningRecordId:'shark:1',strategyId:'meme-shark',instrumentId:'solana:TOKEN',realized:Object.freeze({netReturnBps:-900}),
  sizing:Object.freeze({diagnosis:'OVER_SIZED' as const}),execution:Object.freeze({diagnosis:'WORSE_THAN_MODELED' as const,excessSlippageBps:120}),
  narrative:Object.freeze({held:false,diagnosis:'DEGRADED_OR_FAILED' as const}),signalsWorked:Object.freeze(['liquidity']),
  signalsFailed:Object.freeze(['wallet-cluster','narrative']),lessonTags:Object.freeze(['NET_LOSS','SIZING_MISALIGNED']),
  evidenceIds:Object.freeze(['shark:e']),createdAt:'2026-10-01T04:00:00.000Z',authority:'LEARNING_ONLY' as const,financialAuthority:'NONE' as const,canExecute:false as const,
 }))
 assert.equal(episode.lane,'MEME')
 assert.equal(episode.thesisDisposition,'INVALIDATED')
 assert.equal(episode.sizingDiagnosis,'OVER_SIZED')
 assert.ok(episode.lessonTags.includes('SIGNAL_FAILED:wallet-cluster'))
})

test('sports process memory feeds the same Purse learning substrate',()=>{
 const learningRecord=records([300])[0]!
 const sports=Object.freeze({
  episodeId:'sports:1',predictionId:'p1',eventId:'event1',sport:'basketball',marketFamily:'moneyline',marketId:'m1',selectionId:'sel1',
  strategyId:'sports-alpha',modelId:'model',modelVersion:'1',informationCutoff:'2026-10-01T01:00:00.000Z',decisionId:'d1',wagerId:'w1',
  settlementId:'set1',processReviewId:'pr1',returnBps:300,closingLineValue:.02,processClass:'GOOD_PROCESS_GOOD_RESULT',
  learningRecord:Object.freeze({...learningRecord,domain:'SPORTS_BETTING' as const,strategyId:'sports-alpha'}),evidenceIds:Object.freeze(['sports:e']),
  resolvedAt:'2026-10-01T04:00:00.000Z',authority:'SPORTS_LEARNING_MEMORY' as const,canAuthorizeLive:false as const,canExecute:false as const,
 }) satisfies SportsLearningEpisode
 const episode=purseLearningFromSportsEpisode(sports)
 assert.equal(episode.lane,'SPORTS')
 assert.equal(episode.thesisDisposition,'SUPPORTED')
 assert.equal(episode.decisionQualityBps,9000)
})

test('personality creates financial temperament but cannot boost live risk',()=>{
 const personality:PursePersonalitySnapshot=Object.freeze({
  version:7,independentAssessmentRequired:true,taste:Object.freeze({novelty:.95,experimentation:.9,conventionTolerance:.1}),
  traits:Object.freeze([]),updatedAt:'2026-10-01T04:00:00.000Z',
 })
 const profile=buildPurseStrategyLearningProfile({
  lane:'STOCK',strategyId:'stock-alpha',episodes:records([3000,2500,2000]).map(purseLearningFromStrategyRecord),
  calibratedAt:'2026-10-01T05:00:00.000Z',minimumSamples:3,
 })
 const liveTemperament=derivePurseFinancialTemperament({personality,profiles:[profile],autonomyMode:'LIVE_GOVERNED_INTENTS',derivedAt:'2026-10-01T05:05:00.000Z',evidenceIds:['personality:e']})
 assert.equal(liveTemperament.explorationBps,0)
 assert.equal(liveTemperament.livePersonalityRiskBoostAllowed,false)
 const context=buildPurseLearningContext({profiles:[profile],temperament:liveTemperament,observedAt:'2026-10-01T05:06:00.000Z'})
 const adjustment=learningAdjustmentForOpportunity({context,lane:'STOCK',strategyId:'stock-alpha',autonomyMode:'LIVE_GOVERNED_INTENTS'})
 assert.ok(adjustment.sizingMultiplierBps<=10000)
 assert.ok(adjustment.scoreMultiplierBps<=10000)
 assert.ok(adjustment.reasonCodes.includes('PERSONALITY_LIVE_RISK_BOOST_FORBIDDEN'))
})

test('paper/shadow temperament can explore unknown strategies without increasing above base risk',()=>{
 const personality:PursePersonalitySnapshot=Object.freeze({
  version:8,independentAssessmentRequired:true,taste:Object.freeze({novelty:1,experimentation:1,conventionTolerance:0}),
  traits:Object.freeze([]),updatedAt:'2026-10-01T04:00:00.000Z',
 })
 const temperament=derivePurseFinancialTemperament({personality,profiles:[],autonomyMode:'PAPER_AUTONOMOUS',derivedAt:'2026-10-01T05:05:00.000Z',evidenceIds:['personality:e']})
 const context=buildPurseLearningContext({profiles:[],temperament,observedAt:'2026-10-01T05:06:00.000Z'})
 const adjustment=learningAdjustmentForOpportunity({context,lane:'CRYPTO',strategyId:'new-strategy',autonomyMode:'PAPER_AUTONOMOUS'})
 assert.ok(adjustment.reasonCodes.includes('PAPER_EXPLORATION_ALLOWED'))
 assert.ok(adjustment.scoreMultiplierBps<=10000)
 assert.equal(adjustment.sizingMultiplierBps,10000)
})
